export interface LLMRequest {
  method: string;
  url: string;
  body?: any;
}

export interface LLMResponse {
  thoughts?: string;
  requests?: LLMRequest[];
  process_results?: boolean;
  result_summary?: string;
  tables?: string[];
  subtasks?: {
    thoughts?: string;
    requests?: LLMRequest[];
    process_results?: boolean;
    result_summary?: string;
  }[];
  summary?: string;
} 