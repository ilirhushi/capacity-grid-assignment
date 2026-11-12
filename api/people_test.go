package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestUpdatePersonRejectsInvalidInput(t *testing.T) {
	tests := []struct{ name, id, body string }{
		{"missing hours", "1", `{}`},
		{"malformed JSON", "1", `{`},
		{"negative", "1", `{"weeklyHours":-1}`},
		{"above maximum", "1", `{"weeklyHours":169}`},
		{"non-finite", "1", `{"weeklyHours":NaN}`},
		{"extra field", "1", `{"weeklyHours":40,"role":"admin"}`},
		{"extra object", "1", `{"weeklyHours":40}{"weeklyHours":20}`},
		{"invalid id", "abc", `{"weeklyHours":40}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPatch, "/api/people/"+tt.id, strings.NewReader(tt.body))
			request.SetPathValue("id", tt.id)
			response := httptest.NewRecorder()
			(&server{}).handleUpdatePerson(response, request)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", response.Code)
			}
		})
	}
}

func TestUpdatePersonReturnsNotFound(t *testing.T) {
	db, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	request := httptest.NewRequest(http.MethodPatch, "/api/people/9999999", strings.NewReader(`{"weeklyHours":40}`))
	request.SetPathValue("id", "9999999")
	response := httptest.NewRecorder()
	(&server{db: db}).handleUpdatePerson(response, request)
	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", response.Code)
	}
}
