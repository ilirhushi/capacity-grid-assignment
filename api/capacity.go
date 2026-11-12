package main

import (
	"net/http"
	"time"
)

type capacityPerson struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	WeeklyHours float64   `json:"weeklyHours"`
	Allocated   []float64 `json:"allocated"`
}

type capacityResponse struct {
	Weeks  []string         `json:"weeks"`
	People []capacityPerson `json:"people"`
}

func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
	from, fromErr := time.Parse("2006-01-02", r.URL.Query().Get("from"))
	to, toErr := time.Parse("2006-01-02", r.URL.Query().Get("to"))
	if fromErr != nil || toErr != nil || to.Before(from) || to.Sub(from) > 732*24*time.Hour {
		http.Error(w, "from and to must be valid dates in ascending order, at most two years apart", http.StatusBadRequest)
		return
	}
	first := from.AddDate(0, 0, -(int(from.Weekday())+6)%7)
	last := to.AddDate(0, 0, -(int(to.Weekday())+6)%7)
	response := capacityResponse{Weeks: []string{}, People: []capacityPerson{}}
	for day := first; !day.After(last); day = day.AddDate(0, 0, 7) {
		response.Weeks = append(response.Weeks, day.Format("2006-01-02"))
	}

	// An assignment fraction is a share of an eight-hour working day.
	rows, err := s.db.Query(r.Context(), `
		WITH allocation AS (
			SELECT a.person_id, date_trunc('week', d.day)::date AS week_start,
			       sum(a.hours_per_day * 8)::double precision AS hours
			FROM assignments a
			CROSS JOIN LATERAL generate_series(
				greatest(a.start_date, $1::date),
				least(a.end_date, $2::date + 6), interval '1 day'
			) AS d(day)
			WHERE a.start_date <= $2::date + 6
			  AND a.end_date >= $1::date
			  AND extract(isodow FROM d.day) <= 5
			GROUP BY a.person_id, date_trunc('week', d.day)::date
		)
		SELECT p.id, p.name, p.weekly_hours::double precision,
		       coalesce(a.hours, 0)
		FROM people p
		CROSS JOIN generate_series($1::date, $2::date, interval '1 week') AS w(week_start)
		LEFT JOIN allocation a ON a.person_id = p.id AND a.week_start = w.week_start
		ORDER BY p.name, p.id, w.week_start
	`, first.Format("2006-01-02"), last.Format("2006-01-02"))
	if err != nil {
		http.Error(w, "could not load capacity", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var name string
		var weeklyHours, allocated float64
		if err := rows.Scan(&id, &name, &weeklyHours, &allocated); err != nil {
			http.Error(w, "could not read capacity", http.StatusInternalServerError)
			return
		}
		if len(response.People) == 0 || response.People[len(response.People)-1].ID != id {
			response.People = append(response.People, capacityPerson{ID: id, Name: name, WeeklyHours: weeklyHours, Allocated: make([]float64, 0, len(response.Weeks))})
		}
		person := &response.People[len(response.People)-1]
		person.Allocated = append(person.Allocated, allocated)
	}
	if rows.Err() != nil {
		http.Error(w, "could not read capacity", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, response)
}
