export interface Hall {
  id: number;
  name: string;
  sortOrder: number;
}

export interface Film {
  id: number;
  title: string;
  durationMin: number;
  ageRating: '0+' | '6+' | '12+' | '16+' | '18+';
  format: string | null;
  description: string | null;
  posterUrl: string | null;
  isActive: boolean;
  kinopoiskId: number | null;
}

export interface Showtime {
  id: number;
  hallId: number;
  filmId: number;
  startAt: string; // ISO datetime
  endAt: string; // ISO datetime
  priceFrom: number | null;
  note: string | null;
  isHidden: boolean;
}

export interface ShowtimeWithFilm extends Showtime {
  film: Film;
}

export interface BoardShowtime {
  id: number;
  startAt: string;
  time: string; // HH:mm
  endAt: string;
  hallId: number;
  hallName: string;
  priceFrom: number | null;
  note: string | null;
}

export interface BoardFilm {
  id: number;
  title: string;
  posterUrl: string | null;
  ageRating: string;
  format: string | null;
  durationMin: number;
  description: string | null;
  showtimes: BoardShowtime[];
}

export interface BoardResponse {
  date: string;
  films: BoardFilm[];
}

export interface User {
  id: number;
  username: string;
}
