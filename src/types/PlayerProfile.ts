export interface PlayerProfile {
  username: string;
  playerId: string;
  url: string;
  name?: string;
  avatar?: string;
  followers: number;
  country: string;
  lastOnline: number;
  joined: number;
  status: string;
  isStreaming: boolean;
}
