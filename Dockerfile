FROM golang:1.21.1-alpine

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download

COPY parse.go ./
COPY tdlib.go ./

RUN go build -o /app/main

CMD ["/app/main"]
