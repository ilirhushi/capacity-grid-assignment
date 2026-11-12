package main

import (
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
)

func (s *server) handleUpdatePerson(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id < 1 {
		http.Error(w, "invalid person id", http.StatusBadRequest)
		return
	}
	var input struct {
		WeeklyHours *float64 `json:"weeklyHours"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil || input.WeeklyHours == nil || math.IsNaN(*input.WeeklyHours) || math.IsInf(*input.WeeklyHours, 0) || *input.WeeklyHours < 0 || *input.WeeklyHours > 168 || math.Abs(math.Round(*input.WeeklyHours*100)-*input.WeeklyHours*100) > 1e-7 {
		http.Error(w, "weeklyHours must be a number from 0 to 168 with at most two decimal places", http.StatusBadRequest)
		return
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		http.Error(w, "expected one JSON object", http.StatusBadRequest)
		return
	}
	var person struct {
		ID          int     `json:"id"`
		Name        string  `json:"name"`
		WeeklyHours float64 `json:"weeklyHours"`
	}
	err = s.db.QueryRow(r.Context(), `UPDATE people SET weekly_hours = $2 WHERE id = $1 RETURNING id, name, weekly_hours::double precision`, id, *input.WeeklyHours).Scan(&person.ID, &person.Name, &person.WeeklyHours)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "person not found", http.StatusNotFound)
		} else {
			http.Error(w, "could not update person", http.StatusInternalServerError)
		}
		return
	}
	writeJSON(w, http.StatusOK, person)
}
