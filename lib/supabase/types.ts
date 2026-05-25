// ---------------------------------------------------------------------------
// Database row shapes — mirror the schema.sql exactly.
// Use these types with createClient<Database>() for full type safety.
// ---------------------------------------------------------------------------

export type AuthorMode       = 'anon' | 'ghost';
export type TargetType       = 'thread' | 'reply';
export type ReactionType     = 'echo' | 'dive' | 'ripple' | 'witness' | 'signal';
export type ThreadBadge      = 'REDACTED' | 'RECOVERED' | 'UNVERIFIED' | 'WITNESSED' | 'LEAKED MEMORY' | 'DEAD NODE' | 'ARCHIVIST PICK' | 'SIGNAL ACTIVE';
export type DbArchiveStatus  = 'OPEN' | 'REDACTED' | 'RECOVERED' | 'CORRUPTED';
export type DbSignalLevel    = 'LOW' | 'ACTIVE' | 'UNSTABLE' | 'BURIED';
export type GhostLabel       = 'GHOST' | 'NODE' | 'SIGNAL IDENTITY' | 'ARCHIVE HANDLE';
export type ReportReason     = 'spam' | 'illegal_content' | 'doxxing' | 'harassment' | 'off_topic' | 'other';
export type ReportStatus     = 'pending' | 'reviewed' | 'dismissed';
export type ModerationAction        = 'hide' | 'pin' | 'unpin' | 'flag' | 'restore' | 'redact';
export type RecoveredSignalStatus   = 'pending' | 'approved' | 'archived' | 'rejected';
export type SignalSourceType        = 'reddit' | 'pastebin' | 'wayback' | 'imageboard' | 'irc' | 'forum' | 'other';

// ---------------------------------------------------------------------------
// Row types (what Supabase returns from SELECT)
// ---------------------------------------------------------------------------

export interface DbThread {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: string;
  author_handle: string;
  author_mode: AuthorMode;
  tags: string[];
  is_pinned: boolean;
  is_highlighted: boolean;
  badge: ThreadBadge | null;
  archive_status: DbArchiveStatus | null;
  signal_level: DbSignalLevel | null;
  archive_id: string | null;
  view_count: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

export interface DbReply {
  id: string;
  thread_id: string;
  body: string;
  author_handle: string;
  author_mode: AuthorMode;
  post_number: number;
  reply_to_id: string | null;
  created_at: string;
}

export interface DbReaction {
  id: string;
  target_type: TargetType;
  target_id: string;
  reaction_type: ReactionType;
  anon_fingerprint: string;
  created_at: string;
}

export interface DbReport {
  id: string;
  target_type: TargetType;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface DbGhost {
  id: string;
  handle: string;
  label: GhostLabel;
  joined_at: string;
  active_categories: string[];
  archived_thread_ids: string[];
  echoes_received: number;
  created_at: string;
}

export interface DbCategory {
  id: string;
  name: string;
  color: string;
  display_order: number;
  created_at: string;
}

export interface DbRecoveredSignal {
  id:                   string;
  created_at:           string;
  category:             string;
  title:                string;
  summary:              string;
  source_name:          string;
  source_url:           string | null;
  source_type:          SignalSourceType;
  status:               RecoveredSignalStatus;
  anomaly_score:        number;
  tags:                 string[];
  discovered_at:        string;
  approved_at:          string | null;
  published_thread_id:  string | null;
  submitted_publicly?:  boolean;
}

export type DbRecoveredSignalInsert = Omit<DbRecoveredSignal,
  'id' | 'created_at' | 'approved_at' | 'published_thread_id'
> & {
  id?:                  string;
  created_at?:          string;
  approved_at?:         string | null;
  published_thread_id?: string | null;
};

export interface DbModerationAction {
  id: string;
  target_type: 'thread' | 'reply' | 'ghost';
  target_id: string;
  action: ModerationAction;
  reason: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Insert types (what you send to Supabase on INSERT)
// ---------------------------------------------------------------------------

export type DbThreadInsert = Omit<DbThread,
  'id' | 'view_count' | 'reply_count' | 'created_at' | 'updated_at' | 'last_activity_at'
> & {
  id?: string;
  view_count?: number;
  reply_count?: number;
  created_at?: string;
  updated_at?: string;
  last_activity_at?: string;
};

export type DbReplyInsert = Omit<DbReply, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type DbReactionInsert = Omit<DbReaction, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type DbReportInsert = Omit<DbReport, 'id' | 'status' | 'created_at'> & {
  id?: string;
  status?: ReportStatus;
  created_at?: string;
};

export type DbGhostInsert = Omit<DbGhost, 'id' | 'echoes_received' | 'created_at'> & {
  id?: string;
  echoes_received?: number;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// Supabase Database generic — pass this to createClient<Database>()
//
// Shape must match @supabase/supabase-js v2 expectations exactly:
//  - Each table needs a Relationships array (even if empty)
//  - Views / Functions / Enums / CompositeTypes must use mapped-never syntax
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      threads: {
        Row: DbThread;
        Insert: DbThreadInsert;
        Update: Partial<DbThreadInsert>;
        Relationships: [];
      };
      replies: {
        Row: DbReply;
        Insert: DbReplyInsert;
        Update: Partial<DbReplyInsert>;
        Relationships: [];
      };
      reactions: {
        Row: DbReaction;
        Insert: DbReactionInsert;
        Update: Record<string, never>;
        Relationships: [];
      };
      reports: {
        Row: DbReport;
        Insert: DbReportInsert;
        Update: Record<string, never>;
        Relationships: [];
      };
      ghosts: {
        Row: DbGhost;
        Insert: DbGhostInsert;
        Update: Partial<DbGhostInsert>;
        Relationships: [];
      };
      categories: {
        Row: DbCategory;
        Insert: Omit<DbCategory, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<DbCategory, 'id' | 'created_at'>>;
        Relationships: [];
      };
      moderation_actions: {
        Row: DbModerationAction;
        Insert: Omit<DbModerationAction, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      recovered_signals: {
        Row: DbRecoveredSignal;
        Insert: DbRecoveredSignalInsert;
        Update: Partial<DbRecoveredSignalInsert>;
        Relationships: [];
      };
    };
    Views:          { [_ in never]: never };
    Functions:      { [_ in never]: never };
    Enums:          { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
