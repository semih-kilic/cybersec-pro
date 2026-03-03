/**
 * Shared types for Settings tab components
 */

export interface SettingsMessage {
  type: 'success' | 'error';
  text: string;
}

export interface UserSettings {
  notifications: {
    email_scan_complete: boolean;
    email_weekly_report: boolean;
    browser_notifications: boolean;
  };
  theme: 'dark' | 'light' | 'system';
  timezone: string;
  language: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  created_at: string;
  last_used: string | null;
  permissions: string[];
}

export interface SettingsTabProps {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setMessage: (msg: SettingsMessage | null) => void;
  user: any;
  organization: any;
  userPlan: string;
}
