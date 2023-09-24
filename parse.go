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
	ID       int         `json:"id"`
	Type     string      `json:"type"`
	Text     interface{} `json:"text"`
	Photo    string      `json:"photo"`
	From     string      `json:"from"`
	DateUnix string      `json:"date_unixtime"`
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

	for _, msg := range chat.Messages {
		msgDate, err := strconv.ParseInt(msg.DateUnix, 10, 64)
		if err != nil {
			fmt.Println(err)
			return
		}
		if (msgDate >= fromPeriod) && (msgDate <= toPeriod) && (msg.Text != "") {
			if str, ok := msg.Text.(string); ok {
				if len(str) > 4 {
					messages = append(messages, msg)
				}
			}
		}
	}

	fmt.Println("Messages a year ago:", len(messages))

	// TODO: implement a better algorithm for selecting message of the day
	randomMessageIndex := rand.Intn(len(messages))
	fmt.Println("Random message index:", randomMessageIndex)

	randomMessage := messages[randomMessageIndex]
	fmt.Println("Random message:", randomMessage)

	bot, err := tgbotapi.NewBotAPI(os.Getenv("TELEGRAM_API_KEY"))
	if err != nil {
		log.Panic(err)
	}

	parentChat, err := strconv.ParseInt(os.Getenv("TELEGRAM_CHAT_ID"), 10, 64)
	if err != nil {
		log.Panic(err)
	}

	formattedMessage := fmt.Sprintf("MOTD from *%s*:\n%s", randomMessage.From, randomMessage.Text)

	if os.Getenv("TELEGRAM_DRY_RUN") == "true" {
		fmt.Println("Dry run, not sending message")
		fmt.Println(formattedMessage)
	} else {
		// TODO: support other message types, include photos
		msg := tgbotapi.NewMessage(parentChat, formattedMessage)
		msg.ReplyToMessageID = randomMessage.ID
		msg.ParseMode = "Markdown"
		msg.AllowSendingWithoutReply = true

		_, err = bot.Send(msg)
		if err != nil {
			log.Panic(err)
		}
	}
}
