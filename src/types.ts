export type UserRole = 'student' | 'teacher';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isAdmin?: boolean;
  grade: string;
  bio: string;
  birthday?: string;
  avatar_url?: string;
  notif_prompt_status?: 'allowed' | 'denied' | '';
  notifications_enabled?: boolean;
  isRestricted?: boolean;
  restrictionReason?: string;
  lastLoginAt?: string;
  created_at: string;
}

export interface AdminUserRecord {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isAdmin: boolean;
  grade: string;
  created_at: string;
}

export interface Chapter {
  chapter_number: number;
  title: string;
  description: string;
  raw_title?: string;
  raw_description?: string;
  updated_at: string;
  question_count: number;
}

export interface Question {
  id: number;
  scope: 'chapter' | 'general';
  chapter_number: number | null;
  chapter_title?: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option?: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  raw_question_text?: string;
  raw_option_a?: string;
  raw_option_b?: string;
  raw_option_c?: string;
  raw_option_d?: string;
  raw_explanation?: string;
  created_at: string;
}

export interface QuizAnswerCheckResult {
  questionId: number;
  selectedOption: 'A' | 'B' | 'C' | 'D';
  selectedOptionText: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  correctOptionText: string;
  isCorrect: boolean;
  explanation: string;
  wrongReason?: string;
  pointsAwarded?: number;
  totalPoints?: number;
  offlineQueued?: boolean;
}

export interface QuizQuestionResult {
  questionId: number;
  chapterNumber: number | null;
  chapterTitle: string | null;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizSubmissionResponse {
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  results: QuizQuestionResult[];
  pointsAwarded?: number;
  totalPoints?: number;
  offlineQueued?: boolean;
}

export interface QuizAttempt {
  id: number;
  mode: 'all_chapters' | 'chapter' | 'general';
  chapter_number: number | null;
  chapter_title: string | null;
  total_questions: number;
  correct_count: number;
  score_percent: number;
  created_at: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  type: 'announcement' | 'material';
  attachment_name: string | null;
  attachment_url: string | null;
  attachment_mime: string | null;
  author_name?: string;
  created_at: string;
}

export interface TeacherThread {
  student_id: number;
  student_name: string;
  student_email: string;
  student_grade: string;
  student_avatar_url?: string;
  last_message_at?: string;
  last_message_text?: string;
  last_attachment_name?: string | null;
  unread_count: number;
}

export interface TeacherMessage {
  id: number;
  student_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: UserRole;
  sender_avatar_url?: string;
  message_text: string;
  attachment_name: string | null;
  attachment_url: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  is_read_by_recipient: number;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  body: string;
  category: 'announcement' | 'question' | 'chapter' | 'material' | 'reply';
  link_tab: TabId;
  is_read: number;
  created_at: string;
}

export interface AdminStudentPerformance {
  id: number;
  name: string;
  email: string;
  grade: string;
  avatar_url: string;
  online: boolean;
  currentSection: string;
  lastActiveAt: string;
  lastLoginAt?: string;
  isRestricted?: boolean;
  restrictionReason?: string;
  quizzesCompleted: number;
  questionsAnswered: number;
  correctAnswers: number;
  accuracyPercent: number;
  avgScorePercent: number;
  bestScorePercent: number;
  teacherMessagesCount: number;
  aiTutorTurns: number;
  performanceScore: number;
  activityScore: number;
}

export interface AdminDashboardSnapshot {
  totalStudents: number;
  activeCount: number;
  activeStudents: AdminStudentPerformance[];
  topStudent: AdminStudentPerformance | null;
  mostActiveStudent: AdminStudentPerformance | null;
  students: AdminStudentPerformance[];
  generatedAt: string;
}

export interface AdminStudentDetailResponse {
  student: AdminStudentPerformance;
  attempts: QuizAttempt[];
}

export interface AdminSearchResults {
  students: AdminStudentPerformance[];
  questions: Array<{
    id: number;
    scope: 'chapter' | 'general';
    chapter_number: number | null;
    chapter_title: string | null;
    question_text: string;
    correct_option: 'A' | 'B' | 'C' | 'D';
  }>;
  chapters: Array<{
    chapter_number: number;
    title: string;
    description: string;
    question_count: number;
  }>;
  messages: Array<{
    id: number;
    student_id: number;
    student_name: string;
    sender_name: string;
    sender_role: UserRole;
    message_text: string;
    attachment_name: string | null;
    created_at: string;
  }>;
}

export type CommunityReactionType = 'like' | 'helpful' | 'celebrate' | 'insightful';

export interface CommunityPeer {
  id: number;
  name: string;
  email?: string;
  role: UserRole;
  isAdmin: boolean;
  grade: string;
  bio: string;
  avatar_url: string;
  online: boolean;
  currentSection: string;
  lastActiveAt: string;
  lastLoginAt?: string;
  isRestricted: boolean;
}

export interface CommunityComment {
  id: number;
  post_id: number;
  author_id: number;
  author_name: string;
  author_avatar_url: string;
  author_role: UserRole;
  author_is_admin: boolean;
  content: string;
  created_at: string;
}

export interface CommunityPost {
  id: number;
  author_id: number;
  author_name: string;
  author_avatar_url: string;
  author_role: UserRole;
  author_is_admin: boolean;
  author_grade: string;
  author_is_restricted: boolean;
  chapter_number: number | null;
  content: string;
  attachment_name: string | null;
  attachment_url: string | null;
  attachment_mime: string | null;
  created_at: string;
  reactionCounts: Record<CommunityReactionType, number>;
  totalReactions: number;
  myReaction: CommunityReactionType | null;
  comments: CommunityComment[];
}

export interface CommunityDmThread {
  peer_id: number;
  peer_name: string;
  peer_avatar_url: string;
  peer_role: UserRole;
  peer_is_admin: boolean;
  peer_grade: string;
  peer_online: boolean;
  peer_is_restricted: boolean;
  last_message_at: string | null;
  last_message_text: string;
  last_attachment_name: string | null;
  unread_count: number;
}

export interface CommunityDirectMessage {
  id: number;
  sender_id: number;
  recipient_id: number;
  sender_name: string;
  sender_avatar_url: string;
  sender_role: UserRole;
  recipient_name: string;
  message_text: string;
  attachment_name: string | null;
  attachment_url: string | null;
  attachment_mime: string | null;
  is_read: number;
  created_at: string;
}

export interface CommunityGroup {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  created_by: number;
  creator_name: string;
  created_at: string;
  member_count: number;
  message_count: number;
  last_message_text: string | null;
  last_message_at: string | null;
  is_member: boolean;
}

export interface CommunityGroupMember {
  id: number;
  name: string;
  avatar_url: string;
  role: UserRole;
  is_admin: boolean;
  grade: string;
  group_role: 'owner' | 'member';
  online: boolean;
}

export interface CommunityGroupMessage {
  id: number;
  group_id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar_url: string;
  sender_role: UserRole;
  sender_is_admin: boolean;
  message_text: string;
  attachment_name: string | null;
  attachment_url: string | null;
  attachment_mime: string | null;
  created_at: string;
}

export interface AdminCommunityOverview {
  postsCount: number;
  commentsCount: number;
  reactionsCount: number;
  dmCount: number;
  groupCount: number;
  groupMsgCount: number;
  openReportsCount: number;
  restrictedCount: number;
}

export interface AdminDmConversationSummary {
  userA: {
    id: number;
    name: string;
    email: string;
    avatar_url: string;
    role: UserRole;
    online: boolean;
    isRestricted: boolean;
  };
  userB: {
    id: number;
    name: string;
    email: string;
    avatar_url: string;
    role: UserRole;
    online: boolean;
    isRestricted: boolean;
  };
  messageCount: number;
  lastMessageAt: string;
  lastMessageText: string;
}

export interface StudentActivityLog {
  id: number;
  user_id: number;
  action_type: string;
  details: string;
  target_type: string;
  target_id: number | null;
  created_at: string;
  user_name: string;
  user_email: string;
  user_role: UserRole;
  user_avatar_url: string;
  user_online: boolean;
  user_is_restricted: boolean;
}

export interface CommunityReport {
  id: number;
  reporter_id: number;
  reporter_name: string;
  reporter_email: string;
  target_type: 'post' | 'comment' | 'dm' | 'group_message' | 'user';
  target_id: number;
  target_user_id: number | null;
  target_user_name: string | null;
  target_user_email: string | null;
  target_user_restricted: boolean;
  reason: string;
  excerpt: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface BackupCounts {
  users: number;
  students: number;
  teachers: number;
  chapters: number;
  questions: number;
  quizAttempts: number;
  announcements: number;
  teacherMessages: number;
  communityPosts: number;
  communityDms: number;
  communityGroups: number;
  notifications: number;
}

export interface DatabaseHealthStats {
  counts: BackupCounts;
  dbSizeBytes: number;
  walSizeBytes: number;
  lastRecoverySnapshotAt: string | null;
  lastRecoveryUsersCount: number;
  backupCount: number;
}

export interface BackupFileInfo {
  filename: string;
  kind: 'sqlite' | 'json';
  reason: string;
  createdAt: string;
  sizeBytes: number;
  isLatestRecovery: boolean;
  usersCount?: number;
  questionsCount?: number;
}

export interface AdminBackupsResponse {
  stats: DatabaseHealthStats;
  backups: BackupFileInfo[];
}

export type CompetitionMedal = 'gold' | 'silver' | 'bronze' | null;

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  name: string;
  grade: string;
  avatar_url: string;
  online: boolean;
  totalPoints: number;
  quizPoints: number;
  activityPoints: number;
  quizzesCompleted: number;
  correctAnswers: number;
  questionsAnswered: number;
  accuracyPercent: number;
  badge: CompetitionMedal;
  isCurrentUser: boolean;
}

export interface CompetitionPointEvent {
  id: number;
  event_key: string;
  event_type: 'correct_answer' | 'quiz_completed' | 'curriculum_activity' | string;
  points: number;
  chapter_number: number | null;
  details: string;
  created_at: string;
}

export interface CompetitionMyStats {
  rank: number | null;
  totalPoints: number;
  quizPoints: number;
  activityPoints: number;
  quizzesCompleted: number;
  correctAnswers: number;
  accuracyPercent: number;
  badge: CompetitionMedal;
  totalStudents: number;
}

export interface CompetitionRules {
  correctAnswer: number;
  quizCompleted: number;
  highScore80Bonus: number;
  perfectScoreBonus: number;
  curriculumActivity: number;
}

export interface CompetitionLeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  topThree: LeaderboardEntry[];
  myStats: CompetitionMyStats;
  recentEvents: CompetitionPointEvent[];
  rules: CompetitionRules;
  generatedAt: string;
}

export interface QueuedPointEvent {
  eventKey: string;
  userId: number;
  eventType: 'correct_answer' | 'quiz_completed' | 'curriculum_activity';
  points: number;
  chapterNumber?: number | null;
  questionId?: number;
  selectedOption?: 'A' | 'B' | 'C' | 'D';
  mode?: 'all_chapters' | 'chapter' | 'general';
  answers?: Record<string, string>;
  details: string;
  createdAt: string;
}

export interface TextbookResource {
  id: number;
  chapter_number: number | null;
  title: string;
  summary: string;
  key_formulas: string;
  resource_type: 'textbook' | 'guide' | 'summary' | 'slides';
  attachment_name: string | null;
  attachment_url: string | null;
  attachment_mime: string | null;
  external_url: string | null;
  created_at: string;
  raw_title?: string;
  raw_summary?: string;
}

export interface TextbookStudyQA {
  id: number;
  chapter_number: number;
  question_text: string;
  answer_text: string;
  explanation_text: string;
  source_label: string;
  created_at: string;
  raw_question_text?: string;
  raw_answer_text?: string;
  raw_explanation_text?: string;
}

export interface CurriculumStudyQA {
  id: number;
  scope: 'chapter' | 'general';
  chapter_number: number | null;
  chapter_title: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  correct_option_text: string;
  explanation: string;
  created_at: string;
}

export interface TextbooksQAResponse {
  chapters: Chapter[];
  resources: TextbookResource[];
  studyQa: TextbookStudyQA[];
  curriculumQa: CurriculumStudyQA[];
  materials: Announcement[];
}

export type TabId =
  | 'home'
  | 'community'
  | 'competition'
  | 'admin-dashboard'
  | 'multiple-choice'
  | 'textbooks-qa'
  | 'general-questions'
  | 'ask-teacher'
  | 'notifications'
  | 'ai-studio'
  | 'profile'
  | 'settings'
  | 'about';
