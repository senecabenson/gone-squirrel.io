/**
 * ClickUp v2 REST API response shapes
 *
 * Only fields we actually use for GoneSquirrel sync are typed here.
 * All optional fields from the API are represented as optional or undefined
 * rather than null because ClickUp omits them rather than returning null.
 */

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/** ClickUp epoch-ms timestamp (returned as numeric string or number) */
export type ClickUpMs = string | number;

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export interface ClickUpTag {
  name: string;
  tag_fg: string; // foreground color (hex)
  tag_bg: string; // background color (hex)
  creator?: number;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type ClickUpStatusType =
  | "open"
  | "custom"
  | "closed"
  | "done"
  | "in_progress"
  | "active";

export interface ClickUpStatus {
  status: string; // e.g. "to do", "in progress", "complete"
  color: string;
  orderindex: number;
  type: ClickUpStatusType;
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

/** ClickUp integer priorities: 1=Urgent, 2=High, 3=Normal, 4=Low, null=none */
export type ClickUpPriorityInt = 1 | 2 | 3 | 4;

export interface ClickUpPriorityObject {
  id: string;
  priority: string; // "urgent" | "high" | "normal" | "low"
  color: string;
  orderindex: string;
}

// ---------------------------------------------------------------------------
// Custom Fields
// ---------------------------------------------------------------------------

export interface ClickUpCustomFieldOption {
  id: string;
  name: string;
  color?: string;
  orderindex: number;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string; // "drop_down" | "text" | "number" | ...
  type_config?: {
    options?: ClickUpCustomFieldOption[];
  };
  value?: unknown; // present when reading from a task
  required?: boolean;
}

// ---------------------------------------------------------------------------
// Assignee
// ---------------------------------------------------------------------------

export interface ClickUpUser {
  id: number;
  username: string;
  email: string;
  color?: string;
  profilePicture?: string;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface ClickUpList {
  id: string;
  name: string;
  orderindex?: number;
  status?: ClickUpStatus;
  statuses?: ClickUpStatus[];
  folder?: {
    id: string;
    name: string;
    hidden: boolean;
    access: boolean;
  };
  space?: {
    id: string;
    name: string;
    access: boolean;
  };
  archived?: boolean;
  override_statuses?: boolean;
  permission_level?: string;
  start_date?: ClickUpMs;
  due_date?: ClickUpMs;
  task_count?: number | null;
}

// ---------------------------------------------------------------------------
// Folder
// ---------------------------------------------------------------------------

export interface ClickUpFolder {
  id: string;
  name: string;
  orderindex?: number;
  override_statuses?: boolean;
  hidden?: boolean;
  space?: {
    id: string;
    name: string;
  };
  task_count?: string;
  lists?: ClickUpList[];
}

// ---------------------------------------------------------------------------
// Space
// ---------------------------------------------------------------------------

export interface ClickUpSpace {
  id: string;
  name: string;
  private?: boolean;
  color?: string;
  avatar?: string;
  admin_can_manage?: boolean;
  statuses?: ClickUpStatus[];
  multiple_assignees?: boolean;
  features?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Team (= "Workspace" in ClickUp terminology)
// ---------------------------------------------------------------------------

export interface ClickUpTeam {
  id: string;
  name: string;
  color?: string;
  avatar?: string;
  members?: Array<{ user: ClickUpUser; invited_by?: ClickUpUser }>;
}

// ---------------------------------------------------------------------------
// Task / Subtask
// ---------------------------------------------------------------------------

export interface ClickUpTask {
  id: string;
  name: string;
  status: ClickUpStatus;
  orderindex?: string;
  date_created?: ClickUpMs;
  date_updated?: ClickUpMs;
  date_closed?: ClickUpMs;
  creator?: ClickUpUser;
  assignees?: ClickUpUser[];
  checklists?: unknown[];
  tags?: ClickUpTag[];
  parent?: string | null; // parent task ID for subtasks
  priority?: ClickUpPriorityObject | null;
  due_date?: ClickUpMs | null;
  due_date_time?: boolean;
  start_date?: ClickUpMs | null;
  start_date_time?: boolean;
  time_estimate?: number | null;
  custom_fields?: ClickUpCustomField[];
  list?: {
    id: string;
    name: string;
    access: boolean;
  };
  folder?: {
    id: string;
    name: string;
    hidden: boolean;
    access: boolean;
  };
  space?: {
    id: string;
  };
  url?: string;
  description?: string;
  subtasks?: ClickUpTask[];
  time_spent?: number;
  points?: number;
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface ClickUpTeamsResponse {
  teams: ClickUpTeam[];
}

export interface ClickUpSpacesResponse {
  spaces: ClickUpSpace[];
}

export interface ClickUpFoldersResponse {
  folders: ClickUpFolder[];
}

export interface ClickUpListsResponse {
  lists: ClickUpList[];
}

export interface ClickUpTasksResponse {
  tasks: ClickUpTask[];
}

// ---------------------------------------------------------------------------
// Task create / update bodies (outbound)
// ---------------------------------------------------------------------------

export interface ClickUpTaskCreateBody {
  name: string;
  description?: string;
  status?: string;
  priority?: ClickUpPriorityInt | null;
  due_date?: number | null;
  due_date_time?: boolean;
  start_date?: number | null;
  start_date_time?: boolean;
  tags?: string[];
  parent?: string | null;
  assignees?: number[];
  check_required_custom_fields?: boolean;
}

export interface ClickUpTaskUpdateBody {
  name?: string;
  description?: string;
  status?: string;
  priority?: ClickUpPriorityInt | null;
  due_date?: number | null;
  due_date_time?: boolean;
  start_date?: number | null;
  start_date_time?: boolean;
  tags?: string[];
  /** On update, assignees is an object with add/rem arrays */
  assignees?: { add?: number[]; rem?: number[] };
}

export interface ClickUpCustomFieldSetBody {
  value: unknown;
}

export interface ClickUpTagBody {
  tag: {
    name: string;
    tag_fg: string;
    tag_bg: string;
  };
}

export interface ClickUpWebhookBody {
  endpoint: string;
  events: string[];
  space_id?: string;
  folder_id?: string;
  list_id?: string;
  task_id?: string;
}

export interface ClickUpWebhookResponse {
  id: string;
  webhook: {
    id: string;
    userid: number;
    team_id: number;
    endpoint: string;
    client_id: string;
    events: string[];
    task_id?: string;
    list_id?: string;
    folder_id?: string;
    space_id?: string;
    health: {
      status: string;
      fail_count: number;
    };
    secret: string;
  };
}

// ---------------------------------------------------------------------------
// Provider settings stored in TaskListMapping.settings
// ---------------------------------------------------------------------------

export interface ClickUpListMappingSettings {
  /** Status strings mapped from ClickUp list statuses */
  statusMap?: ClickUpStatusMap;
  /** Custom field IDs for GoneSquirrel-specific fields */
  customFieldIds?: {
    energy?: string;
    preferredTime?: string;
  };
}

export interface ClickUpStatusMap {
  /** ClickUp status string → GS internal status */
  todo: string[]; // ClickUp status strings that map to GS "todo"
  in_progress: string[]; // → "in_progress"
  completed: string[]; // → "completed"
  /** All raw ClickUp statuses for this list, for display */
  all: ClickUpStatus[];
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export interface ClickUpErrorBody {
  err?: string;
  ECODE?: string;
}
