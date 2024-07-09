package main

import (
	"context"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"os"
	"os/signal"
	"time"

	"github.com/gotd/td/telegram"
	"github.com/gotd/td/tg"
)

func getReactions() map[int][]struct {
	UserID   int64
	Reaction string
} {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	reactions := make(map[int][]struct {
		UserID   int64
		Reaction string
	})

	if err := run(ctx, reactions); err != nil {
		panic(err)
	}

	return reactions
}

var MessagesPerPage = 20

func run(ctx context.Context, reactions map[int][]struct {
	UserID   int64
	Reaction string
}) error {
	log, _ := zap.NewDevelopment(zap.IncreaseLevel(zapcore.InfoLevel), zap.AddStacktrace(zapcore.FatalLevel))
	defer func() { _ = log.Sync() }()

	getReactions := func(ctx context.Context, client *telegram.Client) error {
		// Resolve username to get channel info
		api := tg.NewClient(client)

		channel, err := api.ChannelsGetChannels(ctx, []tg.InputChannelClass{
			&tg.InputChannel{
				ChannelID:  1443641304,
				AccessHash: 0,
			},
		})
		if err != nil {
			log.Sugar().Fatalf("failed to resolve channel: %v", err)
		}

		log.Sugar().Infof("Resolved Channel: %v", channel)

		if len(channel.GetChats()) == 0 {
			log.Sugar().Fatal("No channels found")
		}
		firstChannel, ok := channel.GetChats()[0].(*tg.Channel)
		if !ok {
			log.Sugar().Fatal("First chat is not a channel")
		}

		channelID := firstChannel.ID
		accessHash := firstChannel.AccessHash

		location, err := time.LoadLocation(os.Getenv("TELEGRAM_CHAT_LOCATION"))
		if err != nil {
			log.Sugar().Fatalf("failed to load location: %v", err)
		}
		now := time.Now().In(location)
		fromPeriod := LastYearBod(now)
		toPeriod := LastYearNextDayBod(now)
		offset := 0

		fetchReactions(ctx, err, api, channelID, accessHash, log, reactions, fromPeriod, toPeriod, offset)

		log.Sugar().Infof("Reactions: %v", reactions)

		return nil
	}

	return telegram.BotFromEnvironment(ctx, telegram.Options{
		Logger:    log,
		NoUpdates: true, // don't subscribe to updates in one-shot mode
	}, nil, getReactions)
}

func fetchReactions(ctx context.Context, err error, api *tg.Client, channelID int64, accessHash int64, log *zap.Logger, reactions map[int][]struct {
	UserID   int64
	Reaction string
}, fromPeriod int64, toPeriod int64, offset int) {
	messages, err := api.MessagesGetHistory(ctx, &tg.MessagesGetHistoryRequest{
		Peer: &tg.InputPeerChannel{
			ChannelID:  channelID,
			AccessHash: accessHash,
		},
		OffsetDate: int(toPeriod),
		AddOffset:  offset,
		Limit:      MessagesPerPage,
	})
	if err != nil {
		log.Sugar().Fatalf("failed to fetch messages: %v", err)
	}

	location, err := time.LoadLocation(os.Getenv("TELEGRAM_CHAT_LOCATION"))
	if err != nil {
		log.Sugar().Fatalf("failed to load location: %v", err)
	}

	log.Sugar().Infof("From period: %s", time.Unix(fromPeriod, 0).In(location))
	log.Sugar().Infof("To period: %s", time.Unix(toPeriod, 0).In(location))

	switch v := messages.(type) {
	case *tg.MessagesChannelMessages:
		log.Sugar().Infof("Received %d messages", len(v.Messages))
		for _, m := range v.Messages {
			msg, ok := m.(*tg.Message)
			if !ok {
				log.Sugar().Errorf("Unknown message type: %T", m)
				continue
			}
			for _, r := range msg.Reactions.RecentReactions {
				reactions[msg.ID] = append(reactions[msg.ID], struct {
					UserID   int64
					Reaction string
				}{
					UserID:   r.PeerID.(*tg.PeerUser).UserID,
					Reaction: r.Reaction.(*tg.ReactionEmoji).Emoticon,
				})
			}
		}
		if len(v.Messages) == MessagesPerPage {
			log.Sugar().Infof("First message date: %s", time.Unix(int64(v.Messages[0].(*tg.Message).Date), 0).In(location))
			log.Sugar().Infof("Last message date: %s", time.Unix(int64(v.Messages[len(v.Messages)-1].(*tg.Message).Date), 0).In(location))
			if v.Messages[len(v.Messages)-1].(*tg.Message).Date > int(fromPeriod) {

				log.Sugar().Infof("Fetching next %d messages", MessagesPerPage)
				fetchReactions(ctx, err, api, channelID, accessHash, log, reactions, fromPeriod, toPeriod, offset+MessagesPerPage)
			}
		}
	default:
		panic(v)
	}
}
