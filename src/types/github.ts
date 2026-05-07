export interface StarredRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  forks_count: number;
}

export type SearchRepo = StarredRepo;

export interface SearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: SearchRepo[];
}
