export interface OAuthErrorBody {
  error: string;
  error_description: string;
}

export function oauthError(error: string, description: string): OAuthErrorBody {
  return { error, error_description: description };
}
