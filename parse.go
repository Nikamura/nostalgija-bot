package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strconv"
	"time"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"

	_ "github.com/joho/godotenv/autoload"
)

type Chat struct {
	Name     string    `json:"name"`
	Type     string    `json:"type"`
	Messages []Message `json:"messages"`
}

type Message struct {
	ID               int         `json:"id"`
	Type             string      `json:"type"`
	Text             interface{} `json:"text"`
	Photo            string      `json:"photo"`
	From             string      `json:"from"`
	DateUnix         string      `json:"date_unixtime"`
	ReplyToMessageID int         `json:"reply_to_message_id"`
}

func LastYearBod(t time.Time) int64 {
	year, month, day := t.Date()
	return time.Date(year-1, month, day, 0, 0, 0, 0, t.Location()).Unix()
}

func LastYearNextDayBod(t time.Time) int64 {
	year, month, day := t.Date()
	return time.Date(year-1, month, day+1, 0, 0, 0, 0, t.Location()).Unix()
}

func main() {
	jsonFile, err := os.Open(os.Getenv("TELEGRAM_HISTORY_JSON"))
	if err != nil {
		fmt.Println(err)
	}
	defer jsonFile.Close()

	var chat Chat
	decoder := json.NewDecoder(jsonFile)
	if err := decoder.Decode(&chat); err != nil {
		panic(err)
	}

	location, err := time.LoadLocation(os.Getenv("TELEGRAM_CHAT_LOCATION"))
	if err != nil {
		fmt.Println(err)
		return
	}
	now := time.Now().In(location)
	fromPeriod := LastYearBod(now)
	toPeriod := LastYearNextDayBod(now)

	messages := []Message{}
	reply_index := make(map[int]int)

	// select viable messages for the period
	// calculate replies for all messages
	for _, msg := range chat.Messages {
		msgDate, err := strconv.ParseInt(msg.DateUnix, 10, 64)
		if err != nil {
			fmt.Println(err)
			return
		}
		if (msgDate >= fromPeriod) && (msgDate <= toPeriod) {
			if msg.ReplyToMessageID != 0 {
				val, ok := reply_index[msg.ReplyToMessageID]
				if !ok {
					reply_index[msg.ReplyToMessageID] = 0
				}
				reply_index[msg.ReplyToMessageID] = val + 1
			}
			if msg.Text != "" {
				if str, ok := msg.Text.(string); ok {
					if len(str) > 4 {
						messages = append(messages, msg)
					}
				}
			} else {
				if msg.Photo != "" {
					messages = append(messages, msg)
				}
			}
		}
	}

	messages_map := make(map[int]Message)
	for _, msg := range messages {
		messages_map[msg.ID] = msg
	}

	//reactions_index := getReactions()
	reactions_index := map[int][]struct {
		UserID   int64
		Reaction string
	}{}
	fmt.Println(reactions_index)

	fmt.Println("Messages a year ago:", len(messages))

	// find message with most replies
	maxReplies := 0
	maxRepliesId := 0
	for id, replies := range reply_index {
		if replies > maxReplies && replies > 1 {
			if _, ok := messages_map[id]; !ok {
				continue
			}
			maxReplies = replies
			maxRepliesId = id
		}
	}

	maxReactions := 0
	maxReactionsId := 0
	for id, reactions := range reactions_index {
		if len(reactions) > maxReactions && len(reactions) > 1 {
			if _, ok := messages_map[id]; !ok {
				continue
			}
			maxReactions = len(reactions)
			maxReactionsId = id
		}
	}

	var selectedMessage Message

	// if not replies & reactions, select random
	// if replies & reactions, select message with most replies with a factor of 1.5
	// if reactions & no replies, select message with most reactions
	var selectionType string

	if maxRepliesId == 0 && maxReactionsId == 0 {
		selectionType = "random"
	} else if maxRepliesId == 0 && maxReactionsId != 0 {
		selectionType = "reactions"
	} else if maxRepliesId != 0 && maxReactionsId == 0 {
		selectionType = "replies"
	} else {
		if float32(maxReplies)*float32(1.5) > float32(maxReactions) {
			selectionType = "replies"
		} else {
			selectionType = "reactions"
		}
	}

	switch selectionType {
	case "random":
		fmt.Println("Selecting random message")
		fmt.Println(messages, len(messages))
		randomMessageIndex := rand.Intn(len(messages))
		randomMessage := messages[randomMessageIndex]
		selectedMessage = randomMessage
	case "reactions":
		fmt.Println("Selecting message with most reactions with reactions:", maxReactions)
		selectedMessage = messages_map[maxReactionsId]
	case "replies":
		fmt.Println("Selecting message with most replies with replies:", maxReplies)
		selectedMessage = messages_map[maxRepliesId]
	}

	fmt.Println("Selected message:", selectedMessage)

	bot, err := tgbotapi.NewBotAPI(os.Getenv("TELEGRAM_API_KEY"))
	if err != nil {
		log.Panic(err)
	}

	parentChat, err := strconv.ParseInt(os.Getenv("TELEGRAM_CHAT_ID"), 10, 64)
	if err != nil {
		log.Panic(err)
	}

	var formattedMessage string

	if selectedMessage.Text != "" {
		formattedMessage = fmt.Sprintf("MOTD from *%s*:\n%s\n\nSelected based on %s", selectedMessage.From, selectedMessage.Text, selectionType)
	} else {
		formattedMessage = fmt.Sprintf("MOTD from *%s*\n\nSelected based on %s", selectedMessage.From, selectionType)
	}

	if os.Getenv("TELEGRAM_DRY_RUN") == "true" {
		fmt.Println("TELEGRAM_DRY_RUN=true, not sending MOTD")
		fmt.Println(formattedMessage)
	} else {
		if selectedMessage.Photo != "" {
			photoBytes, err := os.ReadFile("exports/" + selectedMessage.Photo)
			if err != nil {
				panic(err)
			}
			photoFileBytes := tgbotapi.FileBytes{
				Name:  "picture",
				Bytes: photoBytes,
			}
			photo := tgbotapi.NewPhoto(parentChat, photoFileBytes)
			photo.Caption = formattedMessage
			photo.ParseMode = "Markdown"
			photo.AllowSendingWithoutReply = true
			photo.ReplyToMessageID = selectedMessage.ID

			_, err = bot.Send(photo)
			if err != nil {
				log.Panic(err)
			}
		} else {
			msg := tgbotapi.NewMessage(parentChat, formattedMessage)
			msg.ReplyToMessageID = selectedMessage.ID
			msg.ParseMode = "Markdown"
			msg.AllowSendingWithoutReply = true

			_, err = bot.Send(msg)
			if err != nil {
				log.Panic(err)
			}
		}
	}
}
