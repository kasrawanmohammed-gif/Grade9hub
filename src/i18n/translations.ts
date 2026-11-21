export type AppLanguage = 'en' | 'ku' | 'ar';

export function getLanguageDir(lang: AppLanguage): 'ltr' | 'rtl' {
  return lang === 'ku' || lang === 'ar' ? 'rtl' : 'ltr';
}

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  ku: 'کوردی',
  ar: 'العربية',
};

export function formatMsg(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : ''
  );
}

export interface Translations {
  brand: {
    appName: string;
    scienceStudio: string;
    schoolTag: string;
    motivationalQuote: string;
    motivationalQuotes: string[];
    poweredBy: string;
    splashSubtitle: string;
    offlineMode: string;
    installApp: string;
    installIOS: string;
    installIOSTitle: string;
    installIOSSub: string;
    installIOSStep1: string;
    installIOSStep2: string;
    installIOSStep3: string;
    gotIt: string;
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    studentGreetingTemplate: string;
    heroJourneySubtitle: string;
  };
  nav: {
    home: string;
    community: string;
    competition: string;
    adminDashboard: string;
    multipleChoice: string;
    textbooksQa: string;
    generalQuestions: string;
    askTeacher: string;
    notifications: string;
    scienceStudio: string;
    profile: string;
    settings: string;
    about: string;
    quizzesShort: string;
    teacherShort: string;
    studioShort: string;
    logOut: string;
    openStudioBtn: string;
    expandSidebar: string;
    collapseSidebar: string;
    chooseLanguage: string;
    switchToDark: string;
    switchToLight: string;
  };
  auth: {
    heroBadge: string;
    heroTitle: string;
    heroDesc: string;
    statChaptersLabel: string;
    statDirectTitle: string;
    statDirectLabel: string;
    statPwaLabel: string;
    loginTab: string;
    registerTab: string;
    welcomeBack: string;
    loginSubtitle: string;
    emailLabel: string;
    passwordLabel: string;
    forgotPassword: string;
    loginBtn: string;
    signingIn: string;
    createTitle: string;
    createSubtitle: string;
    fullNameLabel: string;
    emailRegisterLabel: string;
    birthdayLabel: string;
    gradeLabel: string;
    gradePlaceholder: string;
    passwordCreateLabel: string;
    confirmPasswordRegisterLabel: string;
    confirmPasswordPlaceholder: string;
    registerBtn: string;
    creatingAccount: string;
    backToLogin: string;
    resetTitle: string;
    resetSubtitle: string;
    registeredGmailLabel: string;
    sendCodeBtn: string;
    sendingCode: string;
    codeLabel: string;
    verifyCodeBtn: string;
    verifyingCode: string;
    newPasswordLabel: string;
    confirmPasswordLabel: string;
    savePasswordBtn: string;
    savingPassword: string;
    returnLoginBtn: string;
    passwordsMismatch: string;
    verifiedMsg: string;
    rememberMe: string;
    savedSessionNote: string;
    dbEmptyTitle: string;
    dbEmptyDesc: string;
    vaultDetectedDesc: string;
    restoreFromFileBtn: string;
    restoringFromVault: string;
    enterAdminCredentialsForRestore: string;
    continueWithGoogle: string;
    cloudSyncBadge: string;
    orEmailSeparator: string;
    googleSignInLoading: string;
    googleSignInFailed: string;
    adminClaimPrompt: string;
  };
  home: {
    welcome: string;
    mainAdmin: string;
    teacherWorkspace: string;
    studentPortal: string;
    heroTitle: string;
    heroDesc: string;
    openChaptersBtn: string;
    askTeacherBtn: string;
    cardModulesLabel: string;
    chaptersCount: string;
    chapterQuestions: string;
    cardGeneralLabel: string;
    generalDesc: string;
    cardAlertsLabel: string;
    alertsDesc: string;
    cardStudioLabel: string;
    studioDesc: string;
    announcementsTitle: string;
    announcementsDesc: string;
    publishBtn: string;
    closeFormBtn: string;
    titleLabel: string;
    categoryLabel: string;
    announcementOpt: string;
    materialOpt: string;
    messageLabel: string;
    attachOptional: string;
    publishNotifyBtn: string;
    publishingNotify: string;
    noAnnouncements: string;
    download: string;
    quickJumpTitle: string;
    quickJumpDesc: string;
    startAllChapters: string;
    chapterWord: string;
    questionSingular: string;
    questionPlural: string;
    topScorersTitle: string;
    topScorersSub: string;
    viewLeaderboardBtn: string;
    yourRankLabel: string;
    ptsUnit: string;
    pendingSyncShort: string;
    noScorersYet: string;
    textbooksCardTitle: string;
    textbooksCardSub: string;
    openTextbooksBtn: string;
    textbooksGuidesLabel: string;
    textbooksQaLabel: string;
    heroSliderLabel: string;
    prevSlideBtn: string;
    nextSlideBtn: string;
    goToSlideBtn: string;
  };
  quiz: {
    mcTitle: string;
    mcSubtitle: string;
    addQuestion: string;
    bulkImport: string;
    allChapters: string;
    combinedBadge: string;
    allChaptersDesc: string;
    totalQuestions: string;
    openChapter: string;
    all11ChaptersBack: string;
    allChaptersQuizTitle: string;
    questionsAvailable: string;
    manageAllQuestions: string;
    backToQuizMode: string;
    addQuestionHere: string;
    loadingQuestions: string;
    noQuestionsYet: string;
    noQuestionsAllDesc: string;
    noQuestionsChDesc: string;
    questionOf: string;
    scoreSoFar: string;
    checkingAnswer: string;
    correctTitle: string;
    wrongTitle: string;
    whyWrong: string;
    correctAnswerLabel: string;
    whyTrue: string;
    whyOptionTrue: string;
    readyNext: string;
    completedLast: string;
    nextQuestion: string;
    finishViewScore: string;
    calculatingScore: string;
    selectPrompt: string;
    quizComplete: string;
    reviewBelow: string;
    retakeQuiz: string;
    correctBadge: string;
    incorrectBadge: string;
    explanationLabel: string;
    generalTitle: string;
    generalSubtitle: string;
    addGeneralBtn: string;
    noGeneralYet: string;
    noGeneralDesc: string;
    tryAgain: string;
    save: string;
    cancel: string;
    saveQuestion: string;
    updateQuestion: string;
    importQuestions: string;
    editQuestion: string;
    addChapterQuestion: string;
    targetChapter: string;
    correctAnswerOpt: string;
    questionTextLabel: string;
    explanationFieldLabel: string;
    bulkTitle: string;
    bulkDesc: string;
    destChapter: string;
    questionSavedMsg: string;
    questionAddedMsg: string;
    bulkImportedMsg: string;
    defaultWrongReason: string;
    pointsEarnedPill: string;
    offlineQueuedAnswerNotice: string;
    offlineQuizSavedTitle: string;
    offlineQuizSavedDesc: string;
    cachedOfflineModeNotice: string;
  };
  askTeacher: {
    title: string;
    teacherSub: string;
    studentSub: string;
    studentConversations: string;
    loadingThreads: string;
    noMessagesTeacher: string;
    newBadge: string;
    backToStudents: string;
    selectStudent: string;
    chooseLeft: string;
    teacherRoleSub: string;
    selectPrompt: string;
    noMessagesChat: string;
    replyPlaceholder: string;
    askPlaceholder: string;
    sending: string;
    send: string;
    download: string;
    onlineLabel: string;
    offlineLabel: string;
  };
  notifications: {
    title: string;
    unreadLabel: string;
    pushActive: string;
    enablePush: string;
    enablingPush: string;
    markAllRead: string;
    allCaughtUp: string;
    emptyDesc: string;
    unreadTag: string;
    categories: {
      announcement: string;
      question: string;
      chapter: string;
      material: string;
      reply: string;
    };
  };
  notifPrompt: {
    title: string;
    subtitle: string;
    allow: string;
    dontAllow: string;
    bannerTitle: string;
    bannerDesc: string;
    bannerEnableBtn: string;
    bannerDismissLabel: string;
  };
  aiStudio: {
    title: string;
    subtitle: string;
    tutorChatTab: string;
    diagramTab: string;
    modelLabel: string;
    rolePresetLabel: string;
    systemInstructionLabel: string;
    clearHistory: string;
    threadTitle: string;
    emptyTitle: string;
    emptyDesc: string;
    thinking: string;
    chatPlaceholder: string;
    send: string;
    retry: string;
    stop: string;
    diagramTitle: string;
    diagramSub: string;
    diagramPromptLabel: string;
    diagramPlaceholder: string;
    resolutionLabel: string;
    aspectRatioLabel: string;
    generateBtn: string;
    generatingBtn: string;
    noVisualsTitle: string;
    noVisualsDesc: string;
    download: string;
    models: {
      hydrogen: string;
      flashLite: string;
      argon: string;
      carbon: string;
    };
    roles: {
      physicsTutorLabel: string;
      physicsTutorInstruction: string;
      stepSolverLabel: string;
      stepSolverInstruction: string;
      labCoachLabel: string;
      labCoachInstruction: string;
    };
  };
  profile: {
    title: string;
    subtitle: string;
    mainAdminLabel: string;
    teacherAccount: string;
    studentAccount: string;
    adminBadge: string;
    fullName: string;
    birthdayLabel: string;
    gradeFocus: string;
    bio: string;
    avatarTitle: string;
    avatarDesc: string;
    uploadAvatar: string;
    changeAvatar: string;
    removeAvatar: string;
    uploadingAvatar: string;
    avatarUpdatedMsg: string;
    avatarRemovedMsg: string;
    changePasswordOpt: string;
    currentPassPlaceholder: string;
    newPassPlaceholder: string;
    saveChanges: string;
    saving: string;
    pushTitle: string;
    pushDesc: string;
    disablePush: string;
    enablePush: string;
    recentAttempts: string;
    noAttempts: string;
    allChaptersCombined: string;
    generalQuestionsLabel: string;
    adminControlsTitle: string;
    adminControlsDesc: string;
    accountsCount: string;
    loadingAccounts: string;
    noAccounts: string;
    mainAdminTag: string;
    adminTeacherTag: string;
    studentTag: string;
    setStudent: string;
    makeAdmin: string;
    confirm: string;
    cancel: string;
    updatedMsg: string;
    roleUpdatedMsg: string;
    accountRemovedMsg: string;
    cropModalTitle: string;
    cropModalSub: string;
    zoomLabel: string;
    rotateBtn: string;
    resetCropBtn: string;
    applyCropUploadBtn: string;
    invalidImageType: string;
    imageTooLarge: string;
    dangerZoneTitle: string;
    dangerZoneDesc: string;
    deleteAccountBtn: string;
    deleteAccountModalTitle: string;
    deleteAccountWarning: string;
    deleteAccountTypeLabel: string;
    deleteAccountPlaceholder: string;
    confirmDeleteAccountBtn: string;
    deletingAccount: string;
    protectedAdminDeleteNote: string;
    refreshAccountsBtn: string;
    searchAccountsPlaceholder: string;
    filterAllAccounts: string;
    filterStudentsOnly: string;
    filterAdminsOnly: string;
    filterOnlineOnly: string;
    filterRestrictedOnly: string;
    inspectEditBtn: string;
    inspectModalTitle: string;
    accountUpdatedMsg: string;
    roleLabel: string;
    sourceLabel: string;
    joinedLabel: string;
    loadAccountsError: string;
  };
  settings: {
    title: string;
    subtitle: string;
    appearanceTitle: string;
    appearanceDesc: string;
    themeLabel: string;
    themeLight: string;
    themeLightDesc: string;
    themeDark: string;
    themeDarkDesc: string;
    themeAuto: string;
    themeAutoDesc: string;
    activeModeResolved: string;
    fontSizeLabel: string;
    fontSizeDesc: string;
    fontSmall: string;
    fontNormal: string;
    fontLarge: string;
    fontXLarge: string;
    fontPreviewLabel: string;
    fontPreviewSample: string;
    languageTitle: string;
    languageDesc: string;
    preferencesTitle: string;
    preferencesDesc: string;
    soundFeedbackLabel: string;
    soundFeedbackDesc: string;
    autoScrollLabel: string;
    autoScrollDesc: string;
    reduceMotionLabel: string;
    reduceMotionDesc: string;
    notificationsTitle: string;
    notificationsDesc: string;
    notificationsStatusEnabled: string;
    notificationsStatusDisabled: string;
    notificationsStatusBlocked: string;
    notificationsBlockedHelp: string;
    openNotificationsBtn: string;
    resetDefaults: string;
    resetDone: string;
    accentThemeTitle: string;
    accentThemeDesc: string;
    accentActiveLabel: string;
    accentPreviewBtn: string;
    accentColors: {
      burgundy: string;
      indigo: string;
      emerald: string;
      violet: string;
      blue: string;
      rose: string;
      amber: string;
    };
  };
  about: {
    kicker: string;
    name: string;
    roleLine: string;
    bioP1: string;
    bioP2: string;
    pillar1Title: string;
    pillar1Desc: string;
    pillar2Title: string;
    pillar2Desc: string;
    pillar3Title: string;
    pillar3Desc: string;
  };
  admin: {
    title: string;
    subtitle: string;
    liveSyncLabel: string;
    refreshBtn: string;
    privacyNote: string;
    searchPlaceholder: string;
    searchClear: string;
    searching: string;
    searchEmpty: string;
    filterAll: string;
    filterStudents: string;
    filterQuestions: string;
    filterChapters: string;
    filterMessages: string;
    activeStudentsTitle: string;
    activeStudentsSub: string;
    onlineNowBadge: string;
    onlineLabel: string;
    offlineLabel: string;
    noActiveStudents: string;
    viewingSection: string;
    topStudentTitle: string;
    topStudentSub: string;
    noTopStudent: string;
    mostActiveTitle: string;
    mostActiveSub: string;
    noMostActive: string;
    leaderboardTitle: string;
    leaderboardSub: string;
    noStudentsYet: string;
    quizzesCompleted: string;
    questionsAnswered: string;
    correctAnswers: string;
    accuracyLabel: string;
    avgScore: string;
    bestScore: string;
    performanceScore: string;
    activityPoints: string;
    teacherQuestions: string;
    aiTutorTurns: string;
    lastActive: string;
    viewStatsBtn: string;
    messageBtn: string;
    openChapterBtn: string;
    openChatBtn: string;
    statsModalTitle: string;
    recentAttemptsTitle: string;
    noStudentAttempts: string;
    closeBtn: string;
    lastLogin: string;
    restrictedBadge: string;
    restrictBtn: string;
    unrestrictBtn: string;
    restrictPromptTitle: string;
    restrictReasonPlaceholder: string;
    confirmRestrictBtn: string;
    deleteUserBtn: string;
    deleteUserModalTitle: string;
    deleteUserModalWarning: string;
    confirmDeleteUserBtn: string;
    deletingUserBtn: string;
    userDeletedSuccess: string;
    cannotDeleteSelf: string;
    cannotDeleteMainAdmin: string;
    monitoringTitle: string;
    monitoringSub: string;
    tabOverview: string;
    tabPrivateDms: string;
    tabGroupChats: string;
    tabActivityLogs: string;
    tabModeration: string;
    statPosts: string;
    statComments: string;
    statReactions: string;
    statPrivateDms: string;
    statGroups: string;
    statGroupMsgs: string;
    statOpenReports: string;
    statRestrictedUsers: string;
    searchDmsPlaceholder: string;
    noDmConversations: string;
    selectDmConversation: string;
    messagesCountLabel: string;
    deleteMsgBtn: string;
    deleteGroupBtn: string;
    noGroupsFound: string;
    selectGroupInspect: string;
    privateGroupBadge: string;
    publicGroupBadge: string;
    searchLogsPlaceholder: string;
    allActionsFilter: string;
    noLogsFound: string;
    filterOpen: string;
    filterResolved: string;
    filterDismissed: string;
    noReportsFound: string;
    reportedBy: string;
    reportedTarget: string;
    reportedReason: string;
    deleteReportedContent: string;
    resolveBtn: string;
    dismissBtn: string;
    statusOpen: string;
    statusResolved: string;
    statusDismissed: string;
    actionLabels: {
      login: string;
      register: string;
      logout: string;
      online: string;
      offline: string;
      post_created: string;
      post_deleted: string;
      comment_created: string;
      reaction_added: string;
      dm_sent: string;
      group_created: string;
      group_joined: string;
      group_message_sent: string;
      quiz_completed: string;
      question_answered: string;
      teacher_message_sent: string;
      ai_tutor_used: string;
      content_reported: string;
      content_deleted: string;
      account_restricted: string;
      account_unrestricted: string;
      report_reviewed: string;
    };
    tabBackups: string;
    backupTitle: string;
    backupSub: string;
    backupProtectionBadge: string;
    backupStatsAccounts: string;
    backupStatsQuestions: string;
    backupStatsMessages: string;
    backupStatsAttempts: string;
    backupStatsDbSize: string;
    backupLastSnapshot: string;
    createBackupBtn: string;
    creatingBackup: string;
    downloadExportBtn: string;
    importBackupBtn: string;
    restoreModeLabel: string;
    restoreModeMerge: string;
    restoreModeReplace: string;
    restoreBtn: string;
    downloadFileBtn: string;
    deleteBackupBtn: string;
    latestSnapshotBadge: string;
    noBackupsYet: string;
    backupCreatedMsg: string;
    backupRestoredMsg: string;
    backupConfirmReplace: string;
    aiDisabledNotice: string;
    tabAccounts: string;
    tabContentControl: string;
    tabAppSettings: string;
    registeredAccountsSub: string;
    editProfileBtn: string;
    saveProfileBtn: string;
    contentControlTitle: string;
    contentControlSub: string;
    openQuizzesBtn: string;
    openGeneralQaBtn: string;
    openTextbooksQaBtn: string;
    openHomeAnnouncementsBtn: string;
    appSettingsTitle: string;
    appSettingsSub: string;
    settingAllowReg: string;
    settingCommunityEnabled: string;
    settingCommunityPosting: string;
    settingAiTutor: string;
    settingDefaultLang: string;
    settingMaintenanceMsg: string;
    settingMaintenancePlaceholder: string;
    saveSettingsBtn: string;
    settingsSavedMsg: string;
  };
  community: {
    title: string;
    subtitle: string;
    privacyBannerTitle: string;
    privacyBannerDesc: string;
    restrictedBannerTitle: string;
    restrictedBannerDefault: string;
    tabFeed: string;
    tabActiveStudents: string;
    tabPrivateMessages: string;
    tabGroupChats: string;
    onlineNowCount: string;
    activeClassmatesTitle: string;
    activeClassmatesSub: string;
    onlineStatus: string;
    offlineStatus: string;
    studyingLabel: string;
    messagePeerBtn: string;
    reportUserBtn: string;
    noPeersFound: string;
    sharePlaceholder: string;
    chapterTagOptional: string;
    noChapterTag: string;
    attachFileBtn: string;
    publishPostBtn: string;
    publishingPost: string;
    searchPostsPlaceholder: string;
    allChaptersFilter: string;
    noPostsYet: string;
    commentsLabel: string;
    writeCommentPlaceholder: string;
    sendCommentBtn: string;
    deleteBtn: string;
    reportBtn: string;
    downloadAttachment: string;
    reactions: {
      like: string;
      helpful: string;
      celebrate: string;
      insightful: string;
    };
    dmThreadsTitle: string;
    searchClassmatesPlaceholder: string;
    selectClassmatePrompt: string;
    noDmMessages: string;
    writeDmPlaceholder: string;
    sendBtn: string;
    sendingBtn: string;
    backToList: string;
    groupsTitle: string;
    createGroupBtn: string;
    createGroupTitle: string;
    groupNameLabel: string;
    groupNamePlaceholder: string;
    groupDescLabel: string;
    groupDescPlaceholder: string;
    groupVisibilityLabel: string;
    groupPublicOpt: string;
    groupPrivateOpt: string;
    selectMembersLabel: string;
    createGroupSubmit: string;
    joinGroupBtn: string;
    leaveGroupBtn: string;
    deleteGroupBtn: string;
    addMemberLabel: string;
    addMemberBtn: string;
    membersCount: string;
    selectGroupPrompt: string;
    joinToChatPrompt: string;
    noGroupMessages: string;
    writeGroupMsgPlaceholder: string;
    reportModalTitle: string;
    reportModalDesc: string;
    reportReasonLabel: string;
    reportReasonPlaceholder: string;
    submitReportBtn: string;
    reportSubmittedMsg: string;
    cancelBtn: string;
    youLabel: string;
    teacherBadge: string;
    restrictedUserTag: string;
    filterAllPeers: string;
    filterOnlinePeers: string;
    filterOfflinePeers: string;
    communityDisabledNotice: string;
    postingPausedNotice: string;
  };
  competition: {
    title: string;
    subtitle: string;
    podiumTitle: string;
    podiumSub: string;
    firstPlace: string;
    secondPlace: string;
    thirdPlace: string;
    yourStandingTitle: string;
    rankLabel: string;
    unrankedLabel: string;
    totalPointsLabel: string;
    quizPointsLabel: string;
    activityPointsLabel: string;
    accuracyLabel: string;
    quizzesLabel: string;
    onlineLiveBadge: string;
    offlineQueuedBadge: string;
    syncingBadge: string;
    syncReadyBadge: string;
    syncedSuccessMsg: string;
    syncNowBtn: string;
    pendingPointsNotice: string;
    searchPlaceholder: string;
    allStudentsTitle: string;
    noStudentsYet: string;
    youBadge: string;
    ptsUnit: string;
    pointsRulesTitle: string;
    ruleCorrectAnswer: string;
    ruleQuizCompleted: string;
    ruleHighScore: string;
    rulePerfectScore: string;
    ruleCurriculumActivity: string;
    offlineNote: string;
    recentHistoryTitle: string;
    noHistoryYet: string;
    cachedOfflineNotice: string;
    teacherViewNotice: string;
    rankCol: string;
    studentCol: string;
    quizzesCol: string;
    accuracyCol: string;
    pointsCol: string;
    eventCorrectAnswer: string;
    eventQuizCompleted: string;
    eventCurriculumActivity: string;
  };
  textbooks: {
    title: string;
    subtitle: string;
    allOverviewTab: string;
    chapterTabPrefix: string;
    generalTabLabel: string;
    searchPlaceholder: string;
    filterAll: string;
    filterWorked: string;
    filterCurriculum: string;
    revealAllBtn: string;
    hideAllBtn: string;
    practiceChapterBtn: string;
    addTextbookBtn: string;
    addQaBtn: string;
    shelfTitle: string;
    shelfSub: string;
    chapterGuideTitle: string;
    keyFormulasLabel: string;
    attachedFileLabel: string;
    openLinkLabel: string;
    downloadBtn: string;
    teacherMaterialsTitle: string;
    noResourcesForChapter: string;
    qaSectionTitle: string;
    qaSectionSub: string;
    qaCountLabel: string;
    showAnswerBtn: string;
    hideAnswerBtn: string;
    correctAnswerHeading: string;
    explanationHeading: string;
    workedBadge: string;
    curriculumBadge: string;
    generalScopeLabel: string;
    noQaFound: string;
    noQaSub: string;
    loadingTextbooks: string;
    offlineCacheNotice: string;
    resourceTypes: {
      textbook: string;
      guide: string;
      summary: string;
      slides: string;
    };
    formResourceTitle: string;
    formTitleLabel: string;
    formChapterLabel: string;
    formAllOverviewOpt: string;
    formTypeLabel: string;
    formSummaryLabel: string;
    formFormulasLabel: string;
    formExternalUrlLabel: string;
    formAttachFileLabel: string;
    formSaveResourceBtn: string;
    formQaTitle: string;
    formEditQaTitle: string;
    formQuestionLabel: string;
    formAnswerLabel: string;
    formExplanationLabel: string;
    formSourceLabel: string;
    formSaveQaBtn: string;
    formUpdateQaBtn: string;
    formCancelBtn: string;
    savingMsg: string;
    resourceAddedMsg: string;
    qaSavedMsg: string;
    deleteConfirmBtn: string;
    officialBookTitle: string;
    officialBookMeta: string;
    officialBookDesc: string;
    previewBookBtn: string;
    previewChapterPageBtn: string;
    previewPdfBtn: string;
    pageLabel: string;
    ofPagesLabel: string;
    prevPageBtn: string;
    nextPageBtn: string;
    coverLabel: string;
    contentsLabel: string;
    fitWidthBtn: string;
    openNewTabBtn: string;
    loadingPageMsg: string;
    pdfLoadErrorMsg: string;
    closeReaderBtn: string;
    contentsJumpBtn: string;
    fullBookBtn: string;
    allChaptersTextbookGridTitle: string;
    allChaptersTextbookGridSub: string;
    readChapterPdfBtn: string;
    textbookShortLabel: string;
    readFullTextbookBtn: string;
    previewTextbookBtn: string;
  };
}

export const TRANSLATIONS: Record<AppLanguage, Translations> = {
  en: {
    brand: {
      appName: 'Grade 9 Hub',
      scienceStudio: 'Science AI Studio',
      schoolTag: 'Grade 9 Hub · Grade 9 Science',
      motivationalQuote: 'Your effort today is the glory of your tomorrow.',
      motivationalQuotes: [
        'Your effort today is the glory of your tomorrow.',
        'Curiosity is the spark that turns questions into discovery.',
        'Every science problem solved today builds a sharper mind.',
        'Small steps in study every day create extraordinary results.',
        'Science rewards patience, practice, and a questioning mind.',
        'Mistakes in practice are stepping stones to mastery.',
      ],
      poweredBy: 'Powered by Mr. Kasrawan',
      splashSubtitle: 'Grade 9 Science Interactive Learning Platform',
      offlineMode: 'Offline Mode — Viewing cached content',
      installApp: 'Install App',
      installIOS: 'Install on iOS',
      installIOSTitle: 'Install Grade 9 Hub on iOS',
      installIOSSub: 'Add to your Home Screen',
      installIOSStep1: "1. Tap the Share button in Safari's toolbar.",
      installIOSStep2: '2. Scroll down and select Add to Home Screen.',
      installIOSStep3: '3. Tap Add in the top-right corner to launch Grade 9 Hub as an app.',
      gotIt: 'Got It',
      greetingMorning: 'Good morning',
      greetingAfternoon: 'Good afternoon',
      greetingEvening: 'Good evening',
      studentGreetingTemplate: '{timeGreeting}, dear student! Welcome',
      heroJourneySubtitle:
        'Wishing you a bright, focused, and successful science learning journey.',
    },
    nav: {
      home: 'Home',
      community: 'Student Community',
      competition: 'Competition / Leaderboard',
      adminDashboard: 'Admin Dashboard',
      multipleChoice: 'Multiple Choice',
      textbooksQa: 'Textbooks & Study Q&A',
      generalQuestions: 'General Questions',
      askTeacher: 'Ask Your Teacher',
      notifications: 'Notifications',
      scienceStudio: 'Science AI Studio',
      profile: 'Profile',
      settings: 'Settings',
      about: 'About',
      quizzesShort: 'Quizzes',
      teacherShort: 'Teacher',
      studioShort: 'AI Studio',
      logOut: 'Log Out',
      openStudioBtn: 'Open Science AI Studio',
      expandSidebar: 'Expand sidebar',
      collapseSidebar: 'Collapse sidebar',
      chooseLanguage: 'Switch language',
      switchToDark: 'Switch to Dark Mode',
      switchToLight: 'Switch to Light Mode',
    },
    auth: {
      heroBadge: 'Grade 9 Science · 11 Chapters',
      heroTitle: 'The official science learning hub for Grade 9 students.',
      heroDesc:
        'Master all 11 chapters with instant quiz feedback, direct support from Mr. Kasrawan, and Science AI Studio.',
      statChaptersLabel: 'Grade 9 Chapters',
      statDirectTitle: 'Direct',
      statDirectLabel: 'Ask Your Teacher',
      statPwaLabel: 'Installable App',
      loginTab: 'Log In',
      registerTab: 'Create Account',
      welcomeBack: 'Welcome Back',
      loginSubtitle: 'Sign in with your Grade 9 student or teacher email.',
      emailLabel: 'Email Address',
      passwordLabel: 'Password',
      forgotPassword: 'Forgot Password?',
      loginBtn: 'Log In to Grade 9 Hub',
      signingIn: 'Signing In...',
      createTitle: 'Create Your Account',
      createSubtitle: 'Register as a Grade 9 student to access all chapters and teacher support.',
      fullNameLabel: 'Full Name',
      emailRegisterLabel: 'Gmail / Email Address',
      birthdayLabel: 'Birthday',
      gradeLabel: 'Grade / Class (Optional)',
      gradePlaceholder: 'e.g. Grade 9A Science',
      passwordCreateLabel: 'Password (minimum 6 characters)',
      confirmPasswordRegisterLabel: 'Confirm Password',
      confirmPasswordPlaceholder: 'Re-enter your password',
      registerBtn: 'Create Student Account',
      creatingAccount: 'Creating Account...',
      backToLogin: 'Back to Log In',
      resetTitle: 'Reset Your Password',
      resetSubtitle: 'Receive a 6-digit verification code at your registered Gmail address.',
      registeredGmailLabel: 'Registered Gmail Address',
      sendCodeBtn: 'Send Verification Code',
      sendingCode: 'Sending Verification Code...',
      codeLabel: '6-Digit Verification Code',
      verifyCodeBtn: 'Verify Code',
      verifyingCode: 'Verifying Code...',
      newPasswordLabel: 'New Password',
      confirmPasswordLabel: 'Confirm New Password',
      savePasswordBtn: 'Save New Password',
      savingPassword: 'Saving Password...',
      returnLoginBtn: 'Return to Log In',
      passwordsMismatch: 'Passwords do not match.',
      verifiedMsg: 'Verification code confirmed. Create your new password below.',
      rememberMe: 'Remember me',
      savedSessionNote: 'Your login session stays saved securely until you manually log out.',
      dbEmptyTitle: 'Server Container Reset Detected (0 Accounts)',
      dbEmptyDesc:
        'This server instance currently has 0 registered accounts. If you have a saved Grade 9 Hub backup (.json), enter your admin email and password above and restore all accounts, messages, and quizzes below—or switch to Create Account to set up again.',
      vaultDetectedDesc:
        'An encrypted browser recovery vault is saved on this device ({count} accounts). Sign in with your administrator email and password to restore all accounts automatically.',
      restoreFromFileBtn: 'Restore Accounts from Backup (.json)',
      restoringFromVault: 'Restoring accounts and data...',
      enterAdminCredentialsForRestore:
        'Enter your administrator email and password in the form above first, then choose your backup .json file.',
      continueWithGoogle: 'Continue with Google',
      cloudSyncBadge: 'Saved permanently in Cloud — survives all app updates & URL changes',
      orEmailSeparator: 'OR',
      googleSignInLoading: 'Connecting with Google...',
      googleSignInFailed: 'Google sign-in could not be completed. Please allow popups and try again.',
      adminClaimPrompt:
        'This server database was reset after an update. Sign in with Google below or switch to Create Account to set your administrator password.',
    },
    home: {
      welcome: 'Welcome',
      mainAdmin: 'Main Administrator',
      teacherWorkspace: 'Teacher Workspace',
      studentPortal: 'Grade 9 Student Portal',
      heroTitle: 'Grade 9 Science Curriculum Hub',
      heroDesc:
        'Practice across all 11 Grade 9 science chapters one question at a time with instant explanations, ask Mr. Kasrawan directly with photos or files, and explore concepts in Science AI Studio.',
      openChaptersBtn: 'Open 11 Chapters',
      askTeacherBtn: 'Ask Your Teacher',
      cardModulesLabel: 'Textbook Modules',
      chaptersCount: '11 Chapters',
      chapterQuestions: 'chapter questions',
      cardGeneralLabel: 'General Bank',
      generalDesc: 'General science questions',
      cardAlertsLabel: 'Unread Alerts',
      alertsDesc: 'Announcements & replies',
      cardStudioLabel: 'Study Support',
      studioDesc: 'Tutor chat & 4K diagrams',
      announcementsTitle: 'Announcements & Study Materials',
      announcementsDesc: 'Updates, notices, and downloadable resources published by Mr. Kasrawan.',
      publishBtn: 'Publish Announcement / File',
      closeFormBtn: 'Close Form',
      titleLabel: 'Title',
      categoryLabel: 'Category',
      announcementOpt: 'Announcement',
      materialOpt: 'Educational Material',
      messageLabel: 'Message',
      attachOptional: 'Attach File or Image (Optional)',
      publishNotifyBtn: 'Publish & Notify Students',
      publishingNotify: 'Publishing & Notifying...',
      noAnnouncements: 'No announcements or materials published yet. Updates from Mr. Kasrawan will appear here.',
      download: 'Download',
      quickJumpTitle: 'Quick Chapter Jump',
      quickJumpDesc: 'Select All Chapters or jump straight into any of Chapters 1–11.',
      startAllChapters: 'Start All Chapters Quiz →',
      chapterWord: 'Chapter',
      questionSingular: 'question',
      questionPlural: 'questions',
      topScorersTitle: 'Top Scorers · Student Competition',
      topScorersSub: 'Earn points by solving questions, completing quizzes, and participating in Grade 9 Science.',
      viewLeaderboardBtn: 'View Leaderboard',
      yourRankLabel: 'Your Rank',
      ptsUnit: 'pts',
      pendingSyncShort: 'queued offline',
      noScorersYet: 'Complete a quiz or answer questions to appear on the top scorers podium.',
      textbooksCardTitle: 'Textbooks & Study Q&A',
      textbooksCardSub: 'Browse Grade 9 science textbook guides, key SI formulas, downloadable materials, and worked Q&A with explanations.',
      openTextbooksBtn: 'Open Textbooks & Q&A',
      textbooksGuidesLabel: 'Chapter Guides & Formulas',
      textbooksQaLabel: 'Solved Study Q&A Bank',
      heroSliderLabel: 'Featured science showcase',
      prevSlideBtn: 'Previous slide',
      nextSlideBtn: 'Next slide',
      goToSlideBtn: 'Go to slide {n}',
    },
    quiz: {
      mcTitle: 'Multiple Choice · 11 Chapters',
      mcSubtitle: 'Select All Chapters for a comprehensive assessment or choose a specific chapter from Chapters 1–11.',
      addQuestion: 'Add Question',
      bulkImport: 'Bulk Import',
      allChapters: 'All Chapters',
      combinedBadge: 'Combined Assessment · Chapters 1–11',
      allChaptersDesc: 'Answer questions drawn across all 11 chapters one by one with instant explanations and review your final score.',
      totalQuestions: 'Total Questions',
      openChapter: 'Open Chapter',
      all11ChaptersBack: 'All 11 Chapters',
      allChaptersQuizTitle: 'All Chapters Combined Quiz',
      questionsAvailable: 'questions available',
      manageAllQuestions: 'Manage All Questions',
      backToQuizMode: 'Back to Quiz Mode',
      addQuestionHere: 'Add Question Here',
      loadingQuestions: 'Loading questions...',
      noQuestionsYet: 'No Questions Added Yet',
      noQuestionsAllDesc: 'Questions added to Chapters 1–11 will automatically appear here.',
      noQuestionsChDesc: 'This chapter is ready and awaiting questions from Mr. Kasrawan.',
      questionOf: 'Question {current} of {total}',
      scoreSoFar: 'Score so far',
      checkingAnswer: 'Checking your answer...',
      correctTitle: 'Correct! Option {opt} is true.',
      wrongTitle: 'Wrong Answer — You selected Option {opt} ({text}).',
      whyWrong: 'Why it is wrong:',
      correctAnswerLabel: 'Correct Answer: Option {opt} — {text}',
      whyTrue: 'Why it is true: ',
      whyOptionTrue: 'Why Option {opt} is true: ',
      readyNext: 'Ready to continue to the next question.',
      completedLast: 'You have completed the final question in this quiz.',
      nextQuestion: 'Next Question',
      finishViewScore: 'Finish & View Final Score',
      calculatingScore: 'Calculating Final Score...',
      selectPrompt: 'Select an answer choice above to see the explanation and unlock the next question.',
      quizComplete: 'Quiz Complete · Final Score',
      reviewBelow: 'Review every question and explanation below.',
      retakeQuiz: 'Retake Quiz',
      correctBadge: 'Correct Answer',
      incorrectBadge: 'Incorrect Answer',
      explanationLabel: 'Explanation:',
      generalTitle: 'General Questions',
      generalSubtitle: 'Cross-topic Grade 9 science questions curated by Mr. Kasrawan.',
      addGeneralBtn: 'Add General Question',
      noGeneralYet: 'No General Questions Yet',
      noGeneralDesc: 'General Grade 9 science questions published by Mr. Kasrawan will appear here.',
      tryAgain: 'Try Again',
      save: 'Save',
      cancel: 'Cancel',
      saveQuestion: 'Save Question',
      updateQuestion: 'Update Question',
      importQuestions: 'Import Questions',
      editQuestion: 'Edit Question',
      addChapterQuestion: 'Add Textbook Chapter Question',
      targetChapter: 'Target Chapter',
      correctAnswerOpt: 'Correct Answer',
      questionTextLabel: 'Question Text (Original Wording)',
      explanationFieldLabel: 'Explanation (Shown immediately after student selects an answer)',
      bulkTitle: 'Bulk Paste Questions',
      bulkDesc: 'Paste multiple questions separated by blank lines using A), B), C), D) and Answer: X.',
      destChapter: 'Destination Chapter',
      questionSavedMsg: 'Question updated successfully.',
      questionAddedMsg: 'Question added to Chapter {chapter} and students notified.',
      bulkImportedMsg: 'Imported {count} questions into Chapter {chapter}.',
      defaultWrongReason: 'Option {opt} does not match the correct scientific principle.',
      pointsEarnedPill: '+{pts} pts earned',
      offlineQueuedAnswerNotice: 'Saved offline — your answer and points will sync and grade automatically when back online.',
      offlineQuizSavedTitle: 'Quiz Saved Offline · Pending Sync',
      offlineQuizSavedDesc: 'You are currently offline. Your answers are saved locally and points will be awarded automatically once reconnected.',
      cachedOfflineModeNotice: 'Offline Study Mode — showing locally cached questions. Points will sync when online.',
    },
    askTeacher: {
      title: 'Ask Your Teacher',
      teacherSub: 'View student questions, inspect attached pictures, download documents, and reply directly.',
      studentSub: 'Send questions, attach photos of exercises, or upload documents directly to Mr. Kasrawan.',
      studentConversations: 'Student Conversations',
      loadingThreads: 'Loading student threads...',
      noMessagesTeacher: 'No student messages yet. Student inquiries will appear here with their full name and attachments.',
      newBadge: 'new',
      backToStudents: 'Students',
      selectStudent: 'Select a Student',
      chooseLeft: 'Choose a student conversation on the left',
      teacherRoleSub: 'Grade 9 Science Teacher · Direct Messaging',
      selectPrompt: 'Select a student from the list to view messages and attachments.',
      noMessagesChat: 'No messages in this conversation yet. Write a question or attach a file below.',
      replyPlaceholder: 'Write your reply to this student...',
      askPlaceholder: 'Ask Mr. Kasrawan a question...',
      sending: 'Sending...',
      send: 'Send',
      download: 'Download',
      onlineLabel: 'Online',
      offlineLabel: 'Offline',
    },
    notifications: {
      title: 'Notifications',
      unreadLabel: 'unread notifications',
      pushActive: 'Push Alerts Active (Disable)',
      enablePush: 'Enable Background Push Alerts',
      enablingPush: 'Enabling...',
      markAllRead: 'Mark All Read',
      allCaughtUp: "You're all caught up",
      emptyDesc: 'Announcements, new chapter questions, study files, and teacher replies will appear here.',
      unreadTag: 'Unread',
      categories: {
        announcement: 'Announcement',
        question: 'Question',
        chapter: 'Chapter',
        material: 'Study Material',
        reply: 'Reply',
      },
    },
    notifPrompt: {
      title: 'Allow Grade 9 Hub to send you notifications?',
      subtitle: 'Get alerts for teacher announcements, new questions, and replies from Mr. Kasrawan.',
      allow: 'Allow',
      dontAllow: "Don't allow",
      bannerTitle: 'Stay updated with Grade 9 Hub alerts',
      bannerDesc: 'Enable notifications to receive announcements, new questions, and replies.',
      bannerEnableBtn: 'Enable Notifications',
      bannerDismissLabel: 'Dismiss notification banner',
    },
    aiStudio: {
      title: 'Science AI Studio',
      subtitle: 'Multi-turn Gemini study tutor and high-resolution (1K, 2K, 4K) science diagram generator.',
      tutorChatTab: 'Study Tutor Chat',
      diagramTab: 'Diagram Generator',
      modelLabel: 'Gemini Model',
      rolePresetLabel: 'Tutor Role Preset',
      systemInstructionLabel: 'System Instruction',
      clearHistory: 'Clear Conversation History',
      threadTitle: 'Multi-Turn Study Thread',
      emptyTitle: 'Ask a Grade 9 Science Question',
      emptyDesc: 'Your conversation maintains full context across turns so you can ask follow-up questions on formulas, work, power, energy, or heat.',
      thinking: 'Thinking...',
      chatPlaceholder: 'Ask about work, power, kinetic energy, heat transfer...',
      send: 'Send',
      retry: 'Retry',
      stop: 'Stop',
      diagramTitle: 'High-Resolution Diagram Generator',
      diagramSub: 'Powered by Gemini 4 Hydrogen diagram engine with selectable 1K, 2K, and 4K PNG output.',
      diagramPromptLabel: 'Diagram or Visual Prompt',
      diagramPlaceholder: 'e.g. Clean educational science diagram of light refraction through a glass prism',
      resolutionLabel: 'Image Resolution',
      aspectRatioLabel: 'Aspect Ratio',
      generateBtn: 'Generate {size} Image',
      generatingBtn: 'Generating {size} Diagram...',
      noVisualsTitle: 'No Generated Visuals Yet',
      noVisualsDesc: 'Describe a science concept, simple machine, or energy diagram and choose 1K, 2K, or 4K resolution.',
      download: 'Download',
      models: {
        hydrogen: 'Gemini 4 Hydrogen (General Tasks)',
        flashLite: 'Gemini 3.1 Flash Lite (Fast Responses)',
        argon: 'Gemini 4 Argon (Complex Interactive STEM)',
        carbon: 'Gemini 4 Carbon (Deep Reasoning & Proofs)',
      },
      roles: {
        physicsTutorLabel: 'Science Concept Tutor',
        physicsTutorInstruction:
          'You are a concise Grade 9 Science Tutor. Explain concepts clearly with key formulas, Latin SI units (N, kg, m, s, m/s, J, W, Hz, Pa, °C, K), and a short real-world example.',
        stepSolverLabel: 'Step-by-Step Problem Solver',
        stepSolverInstruction:
          'You are a Grade 9 Science Problem Solver. List given values, state the formula, show clear steps, and keep standard Latin SI units (N, kg, m, s, m/s, J, W, Hz, Pa, °C, K).',
        labCoachLabel: 'Lab & Experiment Coach',
        labCoachInstruction:
          'You are a Grade 9 Lab Coach. Help design safe science experiments, identify variables, and explain measurements concisely.',
      },
    },
    profile: {
      title: 'Profile & Progress',
      subtitle: 'Manage your profile picture, account details, and review your quiz history.',
      mainAdminLabel: 'Main Administrator & Teacher',
      teacherAccount: 'Teacher Account',
      studentAccount: 'Student Account',
      adminBadge: 'Admin',
      fullName: 'Full Name',
      birthdayLabel: 'Birthday',
      gradeFocus: 'Grade / Subject Focus',
      bio: 'Bio',
      avatarTitle: 'Profile Picture',
      avatarDesc: 'Upload a personal photo to display on your account profile and teacher conversations.',
      uploadAvatar: 'Upload Photo',
      changeAvatar: 'Change Photo',
      removeAvatar: 'Remove Photo',
      uploadingAvatar: 'Uploading...',
      avatarUpdatedMsg: 'Profile picture updated.',
      avatarRemovedMsg: 'Profile picture removed.',
      changePasswordOpt: 'Change Password (Optional)',
      currentPassPlaceholder: 'Current password',
      newPassPlaceholder: 'New password (6+ chars)',
      saveChanges: 'Save Changes',
      saving: 'Saving...',
      pushTitle: 'Push Notifications',
      pushDesc: 'Receive real-time alerts for announcements, new questions, and teacher replies even when the app is closed.',
      disablePush: 'Disable Push',
      enablePush: 'Enable Push',
      recentAttempts: 'Recent Quiz Attempts',
      noAttempts: 'No quiz attempts recorded yet. Complete a chapter or All Chapters quiz to track your scores.',
      allChaptersCombined: 'All Chapters Combined',
      generalQuestionsLabel: 'General Questions',
      adminControlsTitle: 'Administrator Controls · Registered Accounts',
      adminControlsDesc: 'Main Administrator can edit chapters, publish announcements and questions, manage messages, and grant or revoke permissions.',
      accountsCount: 'accounts',
      loadingAccounts: 'Loading accounts...',
      noAccounts: 'No registered accounts found yet.',
      mainAdminTag: 'Main Admin',
      adminTeacherTag: 'Admin / Teacher',
      studentTag: 'Student',
      setStudent: 'Set Student',
      makeAdmin: 'Make Admin',
      confirm: 'Confirm',
      cancel: 'Cancel',
      updatedMsg: 'Profile updated successfully.',
      roleUpdatedMsg: 'Updated {name} to {role}.',
      accountRemovedMsg: 'Account removed.',
      cropModalTitle: 'Crop & Resize Profile Photo',
      cropModalSub: 'Drag to position, zoom, or rotate before saving your 256×256 avatar.',
      zoomLabel: 'Zoom',
      rotateBtn: 'Rotate 90°',
      resetCropBtn: 'Reset',
      applyCropUploadBtn: 'Crop & Upload',
      invalidImageType: 'Please choose a PNG, JPG, WebP, or GIF image (SVG is not supported).',
      imageTooLarge: 'Image must be smaller than 15 MB.',
      dangerZoneTitle: 'Danger Zone · Delete Account',
      dangerZoneDesc: 'Permanently delete your account, quiz history, community posts, messages, and competition points. This cannot be undone.',
      deleteAccountBtn: 'Delete My Account',
      deleteAccountModalTitle: 'Permanently Delete Your Account?',
      deleteAccountWarning: 'All of your quiz attempts, competition points, teacher conversations, and community messages will be permanently deleted and you will be signed out immediately.',
      deleteAccountTypeLabel: 'Type DELETE to confirm permanent deletion',
      deleteAccountPlaceholder: 'Type DELETE',
      confirmDeleteAccountBtn: 'Permanently Delete Account',
      deletingAccount: 'Deleting account...',
      protectedAdminDeleteNote: 'The main administrator account cannot be deleted to protect system continuity.',
      refreshAccountsBtn: 'Refresh',
      searchAccountsPlaceholder: 'Search accounts by name, email, or grade...',
      filterAllAccounts: 'All',
      filterStudentsOnly: 'Students',
      filterAdminsOnly: 'Admins / Teachers',
      filterOnlineOnly: 'Online',
      filterRestrictedOnly: 'Restricted',
      inspectEditBtn: 'Inspect / Edit',
      inspectModalTitle: 'Inspect & Edit Account',
      accountUpdatedMsg: 'Account profile for {name} updated.',
      roleLabel: 'Account Role',
      sourceLabel: 'Registry Source',
      joinedLabel: 'Joined',
      loadAccountsError: 'Could not load registered accounts.',
    },
    settings: {
      title: 'System & Study Settings',
      subtitle: 'Customize display theme, text size, language, and quiz feedback behavior for Grade 9 Science.',
      appearanceTitle: 'Display Theme Mode',
      appearanceDesc: 'Choose White (Light), Dark, or Auto to follow your device system theme automatically.',
      themeLabel: 'Color Mode',
      themeLight: 'White (Light)',
      themeLightDesc: 'Clean warm-white paper canvas for bright rooms.',
      themeDark: 'Dark',
      themeDarkDesc: 'Low-glare dark workspace for comfortable night study.',
      themeAuto: 'Auto (System)',
      themeAutoDesc: 'Matches your phone or computer appearance automatically.',
      activeModeResolved: 'Currently active',
      fontSizeLabel: 'Font Size',
      fontSizeDesc: 'Scale reading text, questions, and answers across every screen.',
      fontSmall: 'Small',
      fontNormal: 'Normal',
      fontLarge: 'Large',
      fontXLarge: 'Extra Large',
      fontPreviewLabel: 'Live Text Preview',
      fontPreviewSample: 'Grade 9 Science: Energy is conserved when transforming between kinetic and potential forms.',
      languageTitle: 'App & Curriculum Language',
      languageDesc: 'Switch all menus, buttons, 11 chapters, and quiz explanations between English, Kurdish, and Arabic.',
      preferencesTitle: 'Study & Accessibility Preferences',
      preferencesDesc: 'Tailor quiz sound cues, automatic scrolling, and interface animations.',
      soundFeedbackLabel: 'Quiz Answer Sound Cues',
      soundFeedbackDesc: 'Play a gentle chime when your answer is checked.',
      autoScrollLabel: 'Auto-Scroll to Explanation',
      autoScrollDesc: 'Keep the explanation and Next Question button smoothly centered after selecting an option.',
      reduceMotionLabel: 'Reduce Motion & Animations',
      reduceMotionDesc: 'Minimize page transitions and motion effects for faster, calmer reading.',
      notificationsTitle: 'Push Alerts & Reminders',
      notificationsDesc: 'Manage background push alerts for new Grade 9 chapters, quizzes, and teacher replies.',
      notificationsStatusEnabled: 'Enabled',
      notificationsStatusDisabled: 'Disabled',
      notificationsStatusBlocked: 'Blocked in Browser Settings',
      notificationsBlockedHelp: 'Notifications are currently blocked by your browser or device. Open your browser site permissions (lock/info icon in the address bar or device App Settings), set Notifications to Allow, then click Enable again.',
      openNotificationsBtn: 'Open Notification Settings',
      resetDefaults: 'Reset All Settings to Defaults',
      resetDone: 'Settings restored to defaults.',
      accentThemeTitle: 'Theme',
      accentThemeDesc: 'Customize the primary accent color used across navigation, buttons, and highlights.',
      accentActiveLabel: 'Active Theme',
      accentPreviewBtn: 'Sample Action',
      accentColors: {
        burgundy: 'Burgundy',
        indigo: 'Indigo',
        emerald: 'Emerald',
        violet: 'Violet',
        blue: 'Blue',
        rose: 'Rose',
        amber: 'Amber',
      },
    },
    about: {
      kicker: 'About the Educator & Creator',
      name: 'Kasrawan Mohammed',
      roleLine: 'Grade 9 Science Teacher | Web Developer',
      bioP1:
        'Kasrawan Mohammed is a dedicated Grade 9 Science educator and full-stack web developer committed to transforming how students explore scientific laws, inquiry, and quantitative problem-solving.',
      bioP2:
        'Combining classroom science instruction with modern web engineering, he designs interactive educational applications that keep students closely connected with structured chapter assessments, direct teacher mentorship, and modern mobile-ready learning tools.',
      pillar1Title: 'Science Education',
      pillar1Desc: 'Concept-first clarity across mechanics, simple machines, energy, heat, and modern Grade 9 science.',
      pillar2Title: 'Educational Web Apps',
      pillar2Desc: 'Responsive, installable PWAs engineered for everyday classroom and home study.',
      pillar3Title: 'Technology & Science',
      pillar3Desc: 'Bridging interactive assessment, instant feedback, and real-time student support.',
    },
    admin: {
      title: 'Admin Analytics & Live Monitor',
      subtitle: 'Search across students, questions, chapters, and messages, monitor live active learners, and track top performers automatically.',
      liveSyncLabel: 'Real-Time Sync Active',
      refreshBtn: 'Refresh',
      privacyNote: 'Privacy Protected: Tracking is strictly limited to in-app educational participation (quizzes, answered questions, teacher inquiries, and AI tutor practice).',
      searchPlaceholder: 'Search students, questions, chapters, and messages by name or keyword...',
      searchClear: 'Clear',
      searching: 'Searching across Grade 9 Hub...',
      searchEmpty: 'No matching students, questions, chapters, or messages found.',
      filterAll: 'All Results',
      filterStudents: 'Students',
      filterQuestions: 'Questions',
      filterChapters: 'Chapters',
      filterMessages: 'Messages',
      activeStudentsTitle: 'Currently Active Students',
      activeStudentsSub: 'Students currently online and studying inside Grade 9 Hub in real time.',
      onlineNowBadge: 'online now',
      onlineLabel: 'Online',
      offlineLabel: 'Offline',
      noActiveStudents: 'No students are currently online right now.',
      viewingSection: 'Studying in',
      topStudentTitle: 'Top Performing Student',
      topStudentSub: 'Automatically ranked highest by quiz scores, correct answers, and accuracy.',
      noTopStudent: 'Rankings will appear once students complete questions or quizzes.',
      mostActiveTitle: 'Most Active Student',
      mostActiveSub: 'Automatically highlighted for active participation across quizzes, questions, and study tools.',
      noMostActive: 'Activity leaders will appear as students participate in learning activities.',
      leaderboardTitle: 'All Students Performance & Activity',
      leaderboardSub: 'Real-time academic overview updated automatically as students answer questions and complete quizzes.',
      noStudentsYet: 'No registered student accounts found yet.',
      quizzesCompleted: 'Quizzes',
      questionsAnswered: 'Answered',
      correctAnswers: 'Correct',
      accuracyLabel: 'Accuracy',
      avgScore: 'Avg Score',
      bestScore: 'Best Score',
      performanceScore: 'Performance Index',
      activityPoints: 'Activity Points',
      teacherQuestions: 'Teacher Questions',
      aiTutorTurns: 'AI Tutor Turns',
      lastActive: 'Last active',
      viewStatsBtn: 'View Details',
      messageBtn: 'Message',
      openChapterBtn: 'Open Chapter',
      openChatBtn: 'Open Conversation',
      statsModalTitle: 'Student Educational Statistics',
      recentAttemptsTitle: 'Recent Quiz Attempts',
      noStudentAttempts: 'This student has not submitted a full quiz attempt yet.',
      closeBtn: 'Close',
      lastLogin: 'Last login',
      restrictedBadge: 'Restricted',
      restrictBtn: 'Restrict',
      unrestrictBtn: 'Unrestrict',
      restrictPromptTitle: 'Restrict Student Communication',
      restrictReasonPlaceholder: 'Reason for restricting community access (e.g. inappropriate language or spam)...',
      confirmRestrictBtn: 'Confirm Restriction',
      deleteUserBtn: 'Delete Account',
      deleteUserModalTitle: 'Delete User Account Permanently?',
      deleteUserModalWarning: 'This will permanently delete this account, revoke all active sessions immediately, and erase their quiz attempts, points, messages, and posts.',
      confirmDeleteUserBtn: 'Delete Account Permanently',
      deletingUserBtn: 'Deleting...',
      userDeletedSuccess: 'Account for {name} was permanently deleted and active sessions were revoked.',
      cannotDeleteSelf: 'You cannot delete your own active account from the admin dashboard.',
      cannotDeleteMainAdmin: 'The main administrator account cannot be deleted.',
      monitoringTitle: 'Community Monitoring, Activity Logs & Safety Moderation',
      monitoringSub: 'Inspect all private messages, group chats, detailed student activity timestamps, and moderation reports.',
      tabOverview: 'Overview',
      tabPrivateDms: 'Private Messages',
      tabGroupChats: 'Group Chats',
      tabActivityLogs: 'Activity Logs',
      tabModeration: 'Safety & Reports',
      statPosts: 'Community Posts',
      statComments: 'Comments',
      statReactions: 'Reactions',
      statPrivateDms: 'Private DMs',
      statGroups: 'Study Groups',
      statGroupMsgs: 'Group Messages',
      statOpenReports: 'Open Reports',
      statRestrictedUsers: 'Restricted Accounts',
      searchDmsPlaceholder: 'Search private conversations by student name or message text...',
      noDmConversations: 'No private student conversations recorded yet.',
      selectDmConversation: 'Select a private conversation to inspect all messages exchanged between both students.',
      messagesCountLabel: 'messages',
      deleteMsgBtn: 'Delete',
      deleteGroupBtn: 'Delete Group',
      noGroupsFound: 'No study groups created yet.',
      selectGroupInspect: 'Select a group chat to inspect all messages and members.',
      privateGroupBadge: 'Private Group',
      publicGroupBadge: 'Public Group',
      searchLogsPlaceholder: 'Filter activity logs by student name, email, or details...',
      allActionsFilter: 'All Activities',
      noLogsFound: 'No matching student activity logs found.',
      filterOpen: 'Open',
      filterResolved: 'Resolved',
      filterDismissed: 'Dismissed',
      noReportsFound: 'No safety reports in this queue.',
      reportedBy: 'Reported by',
      reportedTarget: 'Target',
      reportedReason: 'Reason',
      deleteReportedContent: 'Delete Content',
      resolveBtn: 'Mark Resolved',
      dismissBtn: 'Dismiss',
      statusOpen: 'Open',
      statusResolved: 'Resolved',
      statusDismissed: 'Dismissed',
      actionLabels: {
        login: 'Logged In',
        register: 'Account Registered',
        logout: 'Logged Out',
        online: 'Came Online',
        offline: 'Went Offline',
        post_created: 'Created Post',
        post_deleted: 'Deleted Post',
        comment_created: 'Commented',
        reaction_added: 'Reacted',
        dm_sent: 'Sent Private DM',
        group_created: 'Created Group',
        group_joined: 'Joined Group',
        group_message_sent: 'Sent Group Message',
        quiz_completed: 'Completed Quiz',
        question_answered: 'Answered Question',
        teacher_message_sent: 'Messaged Teacher',
        ai_tutor_used: 'Used AI Tutor',
        content_reported: 'Submitted Report',
        content_deleted: 'Deleted Content',
        account_restricted: 'Restricted Account',
        account_unrestricted: 'Unrestricted Account',
        report_reviewed: 'Reviewed Report',
      },
      tabBackups: 'Backup & Recovery',
      backupTitle: 'Database Preservation, Backups & Recovery',
      backupSub: 'Automatic WAL flushing, pre-migration safety snapshots, and portable backup export/restore protect all accounts, passwords, grades, chapters, quizzes, and messages.',
      backupProtectionBadge: 'Auto-Preservation Active',
      backupStatsAccounts: 'Saved Accounts',
      backupStatsQuestions: 'Questions',
      backupStatsMessages: 'Teacher & Student DMs',
      backupStatsAttempts: 'Quiz Attempts',
      backupStatsDbSize: 'Database File',
      backupLastSnapshot: 'Last auto-recovery snapshot',
      createBackupBtn: 'Create Backup Now',
      creatingBackup: 'Creating Backup...',
      downloadExportBtn: 'Download Full Backup (.json)',
      importBackupBtn: 'Restore from Uploaded File (.json)',
      restoreModeLabel: 'Restore Mode',
      restoreModeMerge: 'Safe Merge (Keep existing newer accounts & records, restore missing)',
      restoreModeReplace: 'Full Replace (Reset to exact snapshot state after safety backup)',
      restoreBtn: 'Restore',
      downloadFileBtn: 'Download',
      deleteBackupBtn: 'Delete',
      latestSnapshotBadge: 'Auto-Recovery Snapshot',
      noBackupsYet: 'No backup snapshots saved yet.',
      backupCreatedMsg: 'Backup snapshot created and verified on disk.',
      backupRestoredMsg: 'Backup restored successfully while preserving administrator permissions.',
      backupConfirmReplace: 'Full Replace will replace live records with this snapshot after creating a safety backup. Continue?',
      aiDisabledNotice: 'AI Studio is currently paused by the administrator.',
      tabAccounts: 'Registered Accounts',
      tabContentControl: 'Content & Curriculum',
      tabAppSettings: 'App Settings',
      registeredAccountsSub: 'Inspect every student and teacher account, edit profile fields, manage admin permissions, restrict accounts, or safely remove accounts.',
      editProfileBtn: 'Edit Profile',
      saveProfileBtn: 'Save Account Changes',
      contentControlTitle: 'Curriculum, Quizzes & Announcements Control',
      contentControlSub: 'Jump directly into editing any Grade 9 Science chapter, quiz bank, general question, textbook Q&A, or classroom announcement.',
      openQuizzesBtn: 'Edit Chapter Quizzes',
      openGeneralQaBtn: 'Edit General Questions',
      openTextbooksQaBtn: 'Edit Textbooks & Study Q&A',
      openHomeAnnouncementsBtn: 'Manage Announcements',
      appSettingsTitle: 'Global Application Settings & Access Control',
      appSettingsSub: 'Configure platform registration, Student Community access, AI Studio availability, default language, and school-wide notice banners.',
      settingAllowReg: 'Allow New Student Registration',
      settingCommunityEnabled: 'Enable Student Community for Students',
      settingCommunityPosting: 'Allow Student Posts, Comments & Messages',
      settingAiTutor: 'Enable AI Studio for Students',
      settingDefaultLang: 'Default Language',
      settingMaintenanceMsg: 'School-Wide Notice Banner (Optional)',
      settingMaintenancePlaceholder: 'Leave blank to hide banner, or write a notice for all users...',
      saveSettingsBtn: 'Save App Settings',
      settingsSavedMsg: 'Application settings saved and applied across Grade 9 Hub.',
    },
    community: {
      title: 'Student Community',
      subtitle: 'Connect with online classmates, share Grade 9 Science posts, exchange private messages, and collaborate in study groups.',
      privacyBannerTitle: 'School Safety & Privacy Notice',
      privacyBannerDesc: 'All Student Community posts, comments, private messages, group chats, and app activities are securely logged and may be reviewed by the school administrator (Mr. Kasrawan) to ensure student safety and a respectful learning environment.',
      restrictedBannerTitle: 'Community Privileges Restricted',
      restrictedBannerDefault: 'Your posting and messaging privileges in the Student Community are currently restricted by the school administrator.',
      tabFeed: 'Educational Feed',
      tabActiveStudents: 'Active Students',
      tabPrivateMessages: 'Private Messages',
      tabGroupChats: 'Group Chats',
      onlineNowCount: 'online now',
      activeClassmatesTitle: 'Active Students & Classmates',
      activeClassmatesSub: 'See who is currently online in Grade 9 Hub and start a study conversation.',
      onlineStatus: 'Online',
      offlineStatus: 'Offline',
      studyingLabel: 'Active in',
      messagePeerBtn: 'Message',
      reportUserBtn: 'Report',
      noPeersFound: 'No classmates registered yet.',
      sharePlaceholder: 'Share a Grade 9 Science insight, formula tip, diagram, or question with classmates...',
      chapterTagOptional: 'Chapter Tag (Optional)',
      noChapterTag: 'General Science',
      attachFileBtn: 'Attach Image / File',
      publishPostBtn: 'Share Post',
      publishingPost: 'Sharing...',
      searchPostsPlaceholder: 'Search posts or classmate names...',
      allChaptersFilter: 'All Chapters',
      noPostsYet: 'No educational posts shared yet. Be the first to post a Grade 9 Science tip!',
      commentsLabel: 'Comments',
      writeCommentPlaceholder: 'Write a helpful comment...',
      sendCommentBtn: 'Comment',
      deleteBtn: 'Delete',
      reportBtn: 'Report',
      downloadAttachment: 'Download attachment',
      reactions: {
        like: 'Like',
        helpful: 'Helpful',
        celebrate: 'Celebrate',
        insightful: 'Insightful',
      },
      dmThreadsTitle: 'Classmate Messages',
      searchClassmatesPlaceholder: 'Search classmates...',
      selectClassmatePrompt: 'Select a classmate to send a private study message.',
      noDmMessages: 'No messages yet. Say hello or ask a science question!',
      writeDmPlaceholder: 'Write a private message...',
      sendBtn: 'Send',
      sendingBtn: 'Sending...',
      backToList: 'Back',
      groupsTitle: 'Study Group Chats',
      createGroupBtn: 'Create Group',
      createGroupTitle: 'Create Study Group',
      groupNameLabel: 'Group Name',
      groupNamePlaceholder: 'e.g. Chapter 4 Energy Study Group',
      groupDescLabel: 'Description (Optional)',
      groupDescPlaceholder: 'Topics, homework focus, or chapter revision plan...',
      groupVisibilityLabel: 'Group Visibility',
      groupPublicOpt: 'Public (Any classmate can join)',
      groupPrivateOpt: 'Private (Invited members & admin only)',
      selectMembersLabel: 'Invite Classmates',
      createGroupSubmit: 'Create Group',
      joinGroupBtn: 'Join Group',
      leaveGroupBtn: 'Leave',
      deleteGroupBtn: 'Delete Group',
      addMemberLabel: 'Add classmate...',
      addMemberBtn: 'Add',
      membersCount: 'members',
      selectGroupPrompt: 'Select a study group on the left or create a new one.',
      joinToChatPrompt: 'Join this public study group to send messages.',
      noGroupMessages: 'No messages in this group yet. Start the discussion!',
      writeGroupMsgPlaceholder: 'Write a message to the group...',
      reportModalTitle: 'Report Inappropriate Content or Behavior',
      reportModalDesc: 'Reports are sent directly to the school administrator (Mr. Kasrawan) for immediate safety review.',
      reportReasonLabel: 'Reason for Reporting',
      reportReasonPlaceholder: 'Describe why this content or message is inappropriate or unsafe...',
      submitReportBtn: 'Submit Report',
      reportSubmittedMsg: 'Safety report submitted to the school administrator.',
      cancelBtn: 'Cancel',
      youLabel: 'You',
      teacherBadge: 'Admin / Teacher',
      restrictedUserTag: 'Restricted',
      filterAllPeers: 'All Classmates',
      filterOnlinePeers: 'Online',
      filterOfflinePeers: 'Offline',
      communityDisabledNotice: 'Student Community is currently disabled by the school administrator.',
      postingPausedNotice: 'Posting and messaging are currently paused in the community (read-only mode).',
    },
    competition: {
      title: 'Student Competition & Leaderboard',
      subtitle: 'Rankings across Grade 9 Hub based on quizzes, correct answers, and active science participation.',
      podiumTitle: 'Top 3 Champions Podium',
      podiumSub: 'Leading students earning Gold, Silver, and Bronze medals.',
      firstPlace: '1st Place · Gold',
      secondPlace: '2nd Place · Silver',
      thirdPlace: '3rd Place · Bronze',
      yourStandingTitle: 'Your Competition Standing',
      rankLabel: 'Rank',
      unrankedLabel: 'Educator View',
      totalPointsLabel: 'Total Points',
      quizPointsLabel: 'Quiz Points',
      activityPointsLabel: 'Activity Points',
      accuracyLabel: 'Accuracy',
      quizzesLabel: 'Quizzes',
      onlineLiveBadge: 'Online · Live Sync Active',
      offlineQueuedBadge: 'Offline · {count} queued ({pts} pts)',
      syncingBadge: 'Syncing queued points...',
      syncReadyBadge: '{count} queued event(s) ready to sync ({pts} pts)',
      syncedSuccessMsg: 'Synced {count} queued activity item(s) and awarded +{pts} pts.',
      syncNowBtn: 'Sync Now',
      pendingPointsNotice: '+{pts} pts queued offline — will upload automatically when connected.',
      searchPlaceholder: 'Search students by name or grade...',
      allStudentsTitle: 'Full Student Rankings',
      noStudentsYet: 'No student scores recorded yet. Complete a quiz to earn the first points!',
      youBadge: 'You',
      ptsUnit: 'pts',
      pointsRulesTitle: 'How Points Are Earned',
      ruleCorrectAnswer: '+{pts} pts per correct quiz answer',
      ruleQuizCompleted: '+{pts} pts for completing a full quiz',
      ruleHighScore: '+{pts} bonus pts for scoring 80%+',
      rulePerfectScore: '+{pts} bonus pts for a 100% score',
      ruleCurriculumActivity: '+{pts} pts for Study AI, Ask Teacher, or Community participation',
      offlineNote: 'Offline progress is safely stored on your device and synced automatically on reconnect.',
      recentHistoryTitle: 'Your Recent Points Activity',
      noHistoryYet: 'Answer quiz questions or join study activities to start earning points.',
      cachedOfflineNotice: 'Viewing cached rankings while offline. Pending points on this device are included.',
      teacherViewNotice: 'Educator & Admin accounts oversee the competition and are not ranked against students.',
      rankCol: 'Rank',
      studentCol: 'Student',
      quizzesCol: 'Quizzes',
      accuracyCol: 'Accuracy',
      pointsCol: 'Points',
      eventCorrectAnswer: 'Correct Quiz Answer',
      eventQuizCompleted: 'Completed Quiz',
      eventCurriculumActivity: 'Curriculum Activity',
    },
    textbooks: {
      title: 'Textbooks & Study Q&A',
      subtitle: 'Grade 9 science textbook chapter guides, SI formulas, downloadable resources, and structured study questions with detailed explanations.',
      allOverviewTab: 'All Chapters Overview',
      chapterTabPrefix: 'Ch.',
      generalTabLabel: 'General Bank',
      searchPlaceholder: 'Search chapter topics, formulas, questions, or explanations...',
      filterAll: 'All Q&As',
      filterWorked: 'Worked Textbook Q&A',
      filterCurriculum: 'Chapter Question Bank',
      revealAllBtn: 'Reveal All Answers',
      hideAllBtn: 'Hide All Answers',
      practiceChapterBtn: 'Practice Chapter Quiz',
      addTextbookBtn: 'Add Textbook / PDF',
      addQaBtn: 'Add Study Q&A',
      shelfTitle: 'Grade 9 Science Textbooks & Chapter Guides',
      shelfSub: 'Core chapter summaries, SI equations, and downloadable teacher PDFs.',
      chapterGuideTitle: 'Chapter Textbook Guide & Files',
      keyFormulasLabel: 'Key SI Formulas',
      attachedFileLabel: 'Textbook File',
      openLinkLabel: 'Open Resource Link',
      downloadBtn: 'Download',
      teacherMaterialsTitle: 'Teacher Uploaded Study Materials',
      noResourcesForChapter: 'No textbook PDF or guide has been added to this chapter yet.',
      qaSectionTitle: 'Structured Study Questions & Explanations',
      qaSectionSub: 'Tap any question to inspect the verified answer and step-by-step explanation.',
      qaCountLabel: 'study Q&As',
      showAnswerBtn: 'Show Answer & Explanation',
      hideAnswerBtn: 'Hide Answer',
      correctAnswerHeading: 'Verified Answer',
      explanationHeading: 'Detailed Explanation',
      workedBadge: 'Textbook Worked Q&A',
      curriculumBadge: 'Curriculum Q&A',
      generalScopeLabel: 'General Science',
      noQaFound: 'No Study Q&As Match This Filter',
      noQaSub: 'Try another chapter tab or clear the search keyword above.',
      loadingTextbooks: 'Loading Grade 9 textbooks & study Q&As...',
      offlineCacheNotice: 'Offline Study Mode — viewing locally cached textbooks and Q&As.',
      resourceTypes: {
        textbook: 'Textbook',
        guide: 'Chapter Guide',
        summary: 'Summary Sheet',
        slides: 'Lesson Slides',
      },
      formResourceTitle: 'Add Textbook PDF or Chapter Study Guide',
      formTitleLabel: 'Title',
      formChapterLabel: 'Chapter (1–11 or General)',
      formAllOverviewOpt: 'General / Full Textbook',
      formTypeLabel: 'Resource Type',
      formSummaryLabel: 'Chapter Summary & Concepts',
      formFormulasLabel: 'Key Equations (keep SI units in Latin: N, kg, m, s, J, W)',
      formExternalUrlLabel: 'External Link (Optional URL)',
      formAttachFileLabel: 'Attach PDF, Image, or Document (Optional)',
      formSaveResourceBtn: 'Publish Textbook Resource',
      formQaTitle: 'Add Textbook Study Q&A',
      formEditQaTitle: 'Edit Study Q&A',
      formQuestionLabel: 'Study Question',
      formAnswerLabel: 'Correct Answer',
      formExplanationLabel: 'Step-by-Step Explanation',
      formSourceLabel: 'Source Tag (e.g. Chapter 1 · Worked Example)',
      formSaveQaBtn: 'Save Study Q&A',
      formUpdateQaBtn: 'Update Study Q&A',
      formCancelBtn: 'Cancel',
      savingMsg: 'Saving...',
      resourceAddedMsg: 'Textbook resource published and saved to persistent storage.',
      qaSavedMsg: 'Study Q&A saved successfully.',
      deleteConfirmBtn: 'Delete',
      officialBookTitle: 'Grade 9 Science Official Textbook',
      officialBookMeta: '306 pages · Ch. 1–11 · PDF',
      officialBookDesc: 'Preview every page inside the app, jump straight to any chapter, or download for offline reading.',
      previewBookBtn: 'Preview Book',
      previewChapterPageBtn: 'Preview in Book',
      previewPdfBtn: 'Preview in App',
      pageLabel: 'Page',
      ofPagesLabel: 'of',
      prevPageBtn: 'Prev',
      nextPageBtn: 'Next',
      coverLabel: 'Cover',
      contentsLabel: 'Contents',
      fitWidthBtn: 'Fit Width',
      openNewTabBtn: 'Open File',
      loadingPageMsg: 'Loading textbook page...',
      pdfLoadErrorMsg: 'Could not display this PDF inline. Open or download the file directly below.',
      closeReaderBtn: 'Close Reader',
      contentsJumpBtn: 'Contents (p.2)',
      fullBookBtn: 'Full Book (p.1)',
      allChaptersTextbookGridTitle: 'Official Textbook Chapters (1–11)',
      allChaptersTextbookGridSub: 'Jump straight to any chapter inside Science_9_Book.pdf (306 pages).',
      readChapterPdfBtn: 'Open Chapter',
      textbookShortLabel: 'Textbook',
      readFullTextbookBtn: 'Read Textbook (306p)',
      previewTextbookBtn: 'Preview Textbook PDF',
    },
  },

  ku: {
    brand: {
      appName: 'ناوەندی پۆلی ٩',
      scienceStudio: 'ستۆدیۆی زیرەکی زانست',
      schoolTag: 'ناوەندی پۆلی ٩ · زانستی پۆلی ٩',
      motivationalQuote: 'هەوڵی ئەمڕۆت، شکۆی سبەینێتە.',
      motivationalQuotes: [
        'هەوڵی ئەمڕۆت، شکۆی سبەینێتە.',
        'پرسیارکردن و کنەکردن سەرەتای هەموو دۆزینەوەیەکی زانستین.',
        'هەر پرسیارێک ئەمڕۆ شیکاری بکەیت، مێشکت بەهێزتر دەکات.',
        'هەنگاوی بچووکی ڕۆژانە لە خوێندندا ئەنجامی گەورە دەهێنێتە دی.',
        'زانست پاداشتی ئارامگری، ڕاهێنان و بیری ورد دەداتەوە.',
        'هەڵەکردن لە ڕاهێناندا پێشەکییە بۆ شارەزابوونی تەواو.',
      ],
      poweredBy: 'ئامادەکراوە لەلایەن م. کەسرەوان',
      splashSubtitle: 'پلاتفۆرمی فێربوونی کارلێکەری زانست بۆ پۆلی ٩',
      offlineMode: 'دۆخی بێ ئینتەرنێت — بینینی ناوەڕۆکی پاشەکەوتکراو',
      installApp: 'دابەزاندنی ئەپ',
      installIOS: 'دابەزاندن لەسەر iOS',
      installIOSTitle: 'دابەزاندنی ناوەندی پۆلی ٩ لەسەر ئایفۆن',
      installIOSSub: 'زیادکردن بۆ سەر شاشەی سەرەکی',
      installIOSStep1: '١. کرتە لە دوگمەی هاوبەشکردن (Share) بکە لە سەفاری.',
      installIOSStep2: '٢. بڕۆ خوارەوە و Add to Home Screen هەڵبژێرە.',
      installIOSStep3: '٣. کرتە لە Add بکە بۆ کردنەوەی وەک ئەپڵیکەیشن.',
      gotIt: 'تێگەیشتم',
      greetingMorning: 'بەیانیت باش',
      greetingAfternoon: 'پاشنیوەڕۆت باش',
      greetingEvening: 'ئێوارەت باش',
      studentGreetingTemplate: '{timeGreeting}، قوتابی خۆشەویست! بەخێربێیت',
      heroJourneySubtitle: 'هیوای گەشتێکی سەرکەوتوو و پڕ لە زانستت بۆ دەخوازین.',
    },
    nav: {
      home: 'سەرەکی',
      community: 'کۆمەڵگەی قوتابیان',
      competition: 'پێشبڕکێ و ڕیزبەندی',
      adminDashboard: 'داشبۆردی بەڕێوەبەر',
      multipleChoice: 'هەڵبژاردنی فرە',
      textbooksQa: 'پەرتووک و پرسیار و وەڵام',
      generalQuestions: 'پرسیارە گشتییەکان',
      askTeacher: 'پرسیار لە مامۆستا',
      notifications: 'ئاگادارکردنەوەکان',
      scienceStudio: 'ستۆدیۆی زیرەکی زانست',
      profile: 'پڕۆفایل',
      settings: 'ڕێکخستنەکان',
      about: 'دەربارە',
      quizzesShort: 'تاقیکردنەوە',
      teacherShort: 'مامۆستا',
      studioShort: 'ستۆدیۆ',
      logOut: 'چوونەدەرەوە',
      openStudioBtn: 'کردنەوەی ستۆدیۆی زیرەکی زانست',
      expandSidebar: 'کردنەوەی مینیو',
      collapseSidebar: 'داخستنی مینیو',
      chooseLanguage: 'گۆڕینی زمان',
      switchToDark: 'گۆڕین بۆ دۆخی تاریک',
      switchToLight: 'گۆڕین بۆ دۆخی ڕووناک',
    },
    auth: {
      heroBadge: 'زانستی پۆلی ٩ · ١١ بەش',
      heroTitle: 'ناوەندی فەرمی فێربوونی زانست بۆ قوتابیانی پۆلی ٩.',
      heroDesc:
        'هەر ١١ بەشەکە بخوێنە بە تاقیکردنەوەی دەستبەجێ، پرسیاری ڕاستەوخۆ لە م. کەسرەوان، و ستۆدیۆی زیرەکی زانست.',
      statChaptersLabel: 'بەشی پۆلی ٩',
      statDirectTitle: 'ڕاستەوخۆ',
      statDirectLabel: 'پرسیار لە مامۆستا',
      statPwaLabel: 'ئەپی دابەزێنراو',
      loginTab: 'چوونەژوورەوە',
      registerTab: 'دروستکردنی هەژمار',
      welcomeBack: 'بەخێربێیتەوە',
      loginSubtitle: 'بە ئیمەیڵی قوتابی پۆلی ٩ یان مامۆستا بچۆ ژوورەوە.',
      emailLabel: 'ناونیشانی ئیمەیڵ',
      passwordLabel: 'وشەی نهێنی',
      forgotPassword: 'وشەی نهێنیت لەبیرچووە؟',
      loginBtn: 'چوونەژوورەوە بۆ ناوەندی پۆلی ٩',
      signingIn: 'چوونەژوورەوە...',
      createTitle: 'هەژمارەکەت دروست بکە',
      createSubtitle: 'وەک قوتابی پۆلی ٩ خۆت تۆمار بکە بۆ گەیشتن بە هەموو بەشەکان و هاوکاری مامۆستا.',
      fullNameLabel: 'ناوی تەواو',
      emailRegisterLabel: 'ئیمەیڵ / جیمەیڵ',
      birthdayLabel: 'ڕۆژی لەدایکبوون',
      gradeLabel: 'پۆل / هۆبە (ئارەزوومەندانە)',
      gradePlaceholder: 'نموونە: پۆلی ٩ئەی زانست',
      passwordCreateLabel: 'وشەی نهێنی (لایەنی کەم ٦ پیت)',
      confirmPasswordRegisterLabel: 'دووبارەکردنەوەی وشەی نهێنی',
      confirmPasswordPlaceholder: 'وشەی نهێنییەکە بنووسەرەوە',
      registerBtn: 'دروستکردنی هەژماری قوتابی',
      creatingAccount: 'دروستکردنی هەژمار...',
      backToLogin: 'گەڕانەوە بۆ چوونەژوورەوە',
      resetTitle: 'گۆڕینی وشەی نهێنی',
      resetSubtitle: 'کۆدێکی ٦ ژمارەیی پێداچوونەوە وەربگرە لە جیمەیڵە تۆمارکراوەکەت.',
      registeredGmailLabel: 'ئیمەیڵی جیمەیڵی تۆمارکراو',
      sendCodeBtn: 'ناردنی کۆدی دڵنیاکردنەوە',
      sendingCode: 'ناردنی کۆد...',
      codeLabel: 'کۆدی ٦ ژمارەیی',
      verifyCodeBtn: 'پشتڕاستکردنەوەی کۆد',
      verifyingCode: 'پشکنینی کۆد...',
      newPasswordLabel: 'وشەی نهێنی نوێ',
      confirmPasswordLabel: 'دووبارەکردنەوەی وشەی نهێنی نوێ',
      savePasswordBtn: 'پاشەکەوتکردنی وشەی نهێنی',
      savingPassword: 'پاشەکەوتکردن...',
      returnLoginBtn: 'گەڕانەوە بۆ چوونەژوورەوە',
      passwordsMismatch: 'وشە نهێنییەکان یەک ناگرنەوە.',
      verifiedMsg: 'کۆدەکە پشتڕاست کرایەوە. وشەی نهێنی نوێ بنووسە.',
      rememberMe: 'لەبیرم مەکە',
      savedSessionNote: 'چوونەژوورەوەکەت بە پارێزراوی پاشەکەوت دەکرێت تا خۆت لێی دەرنەچیت.',
      dbEmptyTitle: 'سێرڤەرەکە سڕاوەتەوە یان نوێکراوەتەوە (٠ هەژمار)',
      dbEmptyDesc:
        'ئەم کۆپییەی سێرڤەر ئێستا هیچ هەژمارێکی تێدا نییە. ئەگەر فایلی پاشەکەوتت (.json) هەیە، ئیمەیڵ و وشەی نهێنی بەڕێوەبەر لە سەرەوە بنووسە و لە خوارەوە هەموو هەژمار و داتاکان بگەڕێنەوە — یان بچۆ بۆ دروستکردنی هەژمار.',
      vaultDetectedDesc:
        'پاشەکەوتی پارێزراوی وێبگەڕ لەسەر ئەم ئامێرە دۆزرایەوە ({count} هەژمار). بە ئیمەیڵ و وشەی نهێنی بەڕێوەبەر بچۆ ژوورەوە بۆ گەڕاندنەوەی خۆکار.',
      restoreFromFileBtn: 'گەڕاندنەوەی هەژمارەکان لە پاشەکەوت (.json)',
      restoringFromVault: 'گەڕاندنەوەی هەژمار و داتاکان...',
      enterAdminCredentialsForRestore:
        'سەرەتا ئیمەیڵ و وشەی نهێنی بەڕێوەبەر لە سەرەوە بنووسە، پاشان فایلی پاشەکەوتی .json هەڵبژێرە.',
      continueWithGoogle: 'بەردەوامبوون بە گووگڵ',
      cloudSyncBadge: 'لە هەور پاشەکەوت دەکرێت — لە نوێکردنەوە و گۆڕینی بەستەردا ناسڕێتەوە',
      orEmailSeparator: 'یان',
      googleSignInLoading: 'پەیوەندیکردن بە هەژماری گووگڵ...',
      googleSignInFailed: 'چوونەژوورەوە بە گووگڵ سەرکەوتوو نەبوو. تکایە ڕێگە بە پۆپئەپ بدە و دووبارە هەوڵبدە.',
      adminClaimPrompt:
        'داتابەیسی سێرڤەر دوای نوێکردنەوە سڕاوەتەوە. لە خوارەوە بە گووگڵ بچۆ ژوورەوە یان بچۆ بۆ دروستکردنی هەژمار بۆ دانانی وشەی نهێنی.',
    },
    home: {
      welcome: 'بەخێربێیت',
      mainAdmin: 'بەڕێوەبەری سەرەکی',
      teacherWorkspace: 'پەنجەرەی مامۆستا',
      studentPortal: 'دەروازەی قوتابی پۆلی ٩',
      heroTitle: 'ناوەندی پڕۆگرامی زانستی پۆلی ٩',
      heroDesc:
        'ڕاهێنان بکە لە هەر ١١ بەشەکەی زانستی پۆلی ٩ پرسیار بە پرسیار لەگەڵ ڕوونکردنەوەی دەستبەجێ، ڕاستەوخۆ پرسیار لە م. کەسرەوان بکە بە وێنە و فایلەوە، و ستۆدیۆی زیرەکی زانست بەکاربهێنە.',
      openChaptersBtn: 'کردنەوەی ١١ بەشەکە',
      askTeacherBtn: 'پرسیار لە مامۆستا',
      cardModulesLabel: 'بەشەکانی پەرتووک',
      chaptersCount: '١١ بەش',
      chapterQuestions: 'پرسیاری بەشەکان',
      cardGeneralLabel: 'بانکی گشتی',
      generalDesc: 'پرسیارە زانستییە گشتییەکان',
      cardAlertsLabel: 'ئاگاداری نەخوێندراوە',
      alertsDesc: 'ڕاگەیاندن و وەڵامەکان',
      cardStudioLabel: 'پاڵپشتی خوێندن',
      studioDesc: 'چاتی مامۆستای زیرەک و وێنەی 4K',
      announcementsTitle: 'ڕاگەیاندن و مەلزەمە و فایلەکان',
      announcementsDesc: 'نوێکاری و ڕاگەیاندن و فایلە بڵاوکراوەکان لەلایەن م. کەسرەوان.',
      publishBtn: 'بڵاوکردنەوەی ڕاگەیاندن / فایل',
      closeFormBtn: 'داخستنی فۆرم',
      titleLabel: 'ناونیشان',
      categoryLabel: 'جۆر',
      announcementOpt: 'ڕاگەیاندن',
      materialOpt: 'مەلزەمە / فایلی خوێندن',
      messageLabel: 'ناوەڕۆکی پەیام',
      attachOptional: 'هاوپێچکردنی فایل یان وێنە (ئارەزوومەندانە)',
      publishNotifyBtn: 'بڵاوکردنەوە و ئاگادارکردنەوەی قوتابیان',
      publishingNotify: 'بڵاوکردنەوە...',
      noAnnouncements: 'هێشتا هیچ ڕاگەیاندن یان مەلزەمەیەک بڵاونەکراوەتەوە.',
      download: 'دابەزاندن',
      quickJumpTitle: 'چوونی خێرا بۆ بەشەکان',
      quickJumpDesc: 'هەموو بەشەکان هەڵبژێرە یان ڕاستەوخۆ بچۆ ناو بەشی ١ تا ١١.',
      startAllChapters: 'دەستپێکردنی تاقیکردنەوەی هەموو بەشەکان ←',
      chapterWord: 'بەشی',
      questionSingular: 'پرسیار',
      questionPlural: 'پرسیار',
      topScorersTitle: 'یەکەمەکان · پێشبڕکێی قوتابیان',
      topScorersSub: 'خاڵ کۆبکەرەوە بە شیکارکردنی پرسیار و تاقیکردنەوەکان و بەشداری زانستی پۆلی ٩.',
      viewLeaderboardBtn: 'بینینی ڕیزبەندی',
      yourRankLabel: 'پلەی تۆ',
      ptsUnit: 'خاڵ',
      pendingSyncShort: 'چاوەڕوانی ئینتەرنێت',
      noScorersYet: 'تاقیکردنەوەیەک تەواو بکە یان وەڵامی پرسیارەکان بدەرەوە بۆ دەرکەوتن لە لیستی یەکەمەکاندا.',
      textbooksCardTitle: 'پەرتووک و پرسیار و وەڵامی خوێندن',
      textbooksCardSub: 'پەرتووکی زانستی پۆلی ٩، یاسا و هاوکێشە زانستییەکان، فایلە دابەزێنراوەکان و پرسیار و وەڵام بە ڕوونکردنەوەی ورد بخوێنەوە.',
      openTextbooksBtn: 'کردنەوەی پەرتووک و وەڵامەکان',
      textbooksGuidesLabel: 'ڕێبەری بەشەکان و هاوکێشەکان',
      textbooksQaLabel: 'بانکی پرسیار و وەڵامی شیکارکراو',
      heroSliderLabel: 'پێشانگای وێنە زانستییەکان',
      prevSlideBtn: 'وێنەی پێشوو',
      nextSlideBtn: 'وێنەی داهاتوو',
      goToSlideBtn: 'چوون بۆ وێنەی {n}',
    },
    quiz: {
      mcTitle: 'هەڵبژاردنی فرە · ١١ بەش',
      mcSubtitle: 'هەموو بەشەکان هەڵبژێرە بۆ تاقیکردنەوەی گشتی یان بەشێکی دیاریکراو لە بەشەکانی ١–١١.',
      addQuestion: 'زیادکردنی پرسیار',
      bulkImport: 'هاوردەکردنی کۆمەڵ',
      allChapters: 'هەموو بەشەکان',
      combinedBadge: 'تاقیکردنەوەی تێکەڵ · بەشەکانی ١–١١',
      allChaptersDesc: 'وەڵامی پرسیارەکانی هەر ١١ بەشەکە بدەرەوە یەک بە یەک لەگەڵ ڕوونکردنەوەی دەستبەجێ.',
      totalQuestions: 'کۆی پرسیارەکان',
      openChapter: 'کردنەوەی بەش',
      all11ChaptersBack: 'هەر ١١ بەشەکە',
      allChaptersQuizTitle: 'تاقیکردنەوەی هەموو بەشەکان',
      questionsAvailable: 'پرسیار بەردەستە',
      manageAllQuestions: 'بەڕێوەبردنی هەموو پرسیارەکان',
      backToQuizMode: 'گەڕانەوە بۆ دۆخی تاقیکردنەوە',
      addQuestionHere: 'زیادکردنی پرسیار لێرە',
      loadingQuestions: 'بارکردنی پرسیارەکان...',
      noQuestionsYet: 'هێشتا پرسیار زیاد نەکراوە',
      noQuestionsAllDesc: 'پرسیارە زیادکراوەکان بۆ بەشەکانی ١–١١ لێرە دەردەکەون.',
      noQuestionsChDesc: 'ئەم بەشە ئامادەیە و چاوەڕوانی پرسیارەکانی م. کەسرەوانە.',
      questionOf: 'پرسیاری {current} لە {total}',
      scoreSoFar: 'نمرەی ئێستا',
      checkingAnswer: 'پشکنینی وەڵامەکەت...',
      correctTitle: 'ڕاستە! هەڵبژاردنی {opt} دروستە.',
      wrongTitle: 'هەڵەیە — تۆ هەڵبژاردنی {opt} ({text})ت هەڵبژارد.',
      whyWrong: 'بۆچی هەڵەیە:',
      correctAnswerLabel: 'وەڵامی ڕاست: هەڵبژاردنی {opt} — {text}',
      whyTrue: 'بۆچی ڕاستە: ',
      whyOptionTrue: 'بۆچی هەڵبژاردنی {opt} ڕاستە: ',
      readyNext: 'ئامادەیت بۆ پرسیاری داهاتوو.',
      completedLast: 'کۆتا پرسیاری ئەم تاقیکردنەوەیەت تەواو کرد.',
      nextQuestion: 'پرسیاری داهاتوو',
      finishViewScore: 'تەواوکردن و بینینی نمرە',
      calculatingScore: 'هەژمارکردنی نمرە...',
      selectPrompt: 'وەڵامێک لە سەرەوە هەڵبژێرە بۆ بینینی ڕوونکردنەوە و کردنەوەی پرسیاری داهاتوو.',
      quizComplete: 'تاقیکردنەوە تەواوبوو · نمرەی کۆتایی',
      reviewBelow: 'پێداچوونەوە بۆ هەموو پرسیارەکان و ڕوونکردنەوەکان لە خوارەوە بکە.',
      retakeQuiz: 'دووبارە تاقیکردنەوە',
      correctBadge: 'وەڵامی ڕاست',
      incorrectBadge: 'وەڵامی هەڵە',
      explanationLabel: 'ڕوونکردنەوە:',
      generalTitle: 'پرسیارە گشتییەکان',
      generalSubtitle: 'پرسیارە گشتییەکانی زانستی پۆلی ٩ لەلایەن م. کەسرەوان.',
      addGeneralBtn: 'زیادکردنی پرسیاری گشتی',
      noGeneralYet: 'هێشتا پرسیاری گشتی نییە',
      noGeneralDesc: 'پرسیارە گشتییەکانی زانستی پۆلی ٩ی بڵاوکراوەی م. کەسرەوان لێرە دەردەکەون.',
      tryAgain: 'هەوڵبدەرەوە',
      save: 'پاشەکەوتکردن',
      cancel: 'پاشگەزبوونەوە',
      saveQuestion: 'پاشەکەوتکردنی پرسیار',
      updateQuestion: 'نوێکردنەوەی پرسیار',
      importQuestions: 'هاوردەکردنی پرسیارەکان',
      editQuestion: 'دەستکاریکردنی پرسیار',
      addChapterQuestion: 'زیادکردنی پرسیاری بەش',
      targetChapter: 'بەشی مەبەست',
      correctAnswerOpt: 'وەڵامی ڕاست',
      questionTextLabel: 'دەقی پرسیار (بە دەقی ڕەسەن)',
      explanationFieldLabel: 'ڕوونکردنەوە (دەستبەجێ دوای هەڵبژاردنی وەڵام نیشان دەدرێت)',
      bulkTitle: 'زیادکردنی پرسیار بە کۆمەڵ',
      bulkDesc: 'پرسیارەکان دابنێ بە هێڵی بەتاڵ لە نێوانیاندا لەگەڵ A), B), C), D) و Answer: X.',
      destChapter: 'بەشی مەبەست',
      questionSavedMsg: 'پرسیارەکە بە سەرکەوتوویی نوێکرایەوە.',
      questionAddedMsg: 'پرسیارەکە بۆ بەشی {chapter} زیادکرا و قوتابیان ئاگادارکرانەوە.',
      bulkImportedMsg: '{count} پرسیار بۆ بەشی {chapter} هاوردە کران.',
      defaultWrongReason: 'هەڵبژاردنی {opt} لەگەڵ بنەما زانستییە ڕاستەکەدا ناگونجێت.',
      pointsEarnedPill: '+{pts} خاڵی بەدەستهاتوو',
      offlineQueuedAnswerNotice: 'بە شێوەی ئۆفلاین پاشەکەوت کرا — وەڵام و خاڵەکانت بە شێوەی خۆکار هاوکات دەکرێن کاتێک ئینتەرنێت دەگەڕێتەوە.',
      offlineQuizSavedTitle: 'تاقیکردنەوە بە ئۆفلاین پاشەکەوت کرا · چاوەڕوانی هاوکاتکردن',
      offlineQuizSavedDesc: 'تۆ ئێستا ئۆفلاینیت. هەموو وەڵامەکانت لۆکاڵی پاشەکەوت کراون و خاڵەکانت بە خۆکار هەژمار دەکرێن کاتێک ئینتەرنێت دەگەڕێتەوە.',
      cachedOfflineModeNotice: 'دۆخی خوێندنی ئۆفلاین — پرسیارە پاشەکەوتکراوەکان نیشان دەدرێن. خاڵەکان لە کاتی ئۆنلایندا هاوکات دەبن.',
    },
    askTeacher: {
      title: 'پرسیار لە مامۆستا بکە',
      teacherSub: 'پرسیارەکانی قوتابیان و وێنە و فایلە هاوپێچکراوەکان ببینە و ڕاستەوخۆ وەڵام بدەرەوە.',
      studentSub: 'پرسیار بنێرە، وێنەی ڕاهێنانەکان یان فایل هاوپێچ بکە و ڕاستەوخۆ بۆ م. کەسرەوانی بنێرە.',
      studentConversations: 'گفتوگۆی قوتابیان',
      loadingThreads: 'بارکردنی گفتوگۆکان...',
      noMessagesTeacher: 'هێشتا هیچ پەیامێکی قوتابیان نییە.',
      newBadge: 'نوێ',
      backToStudents: 'قوتابیان',
      selectStudent: 'قوتابییەک هەڵبژێرە',
      chooseLeft: 'گفتوگۆی قوتابییەک لە لیستەکە هەڵبژێرە',
      teacherRoleSub: 'مامۆستای زانستی پۆلی ٩ · پەیوەندی ڕاستەوخۆ',
      selectPrompt: 'قوتابییەک هەڵبژێرە بۆ بینینی پەیام و هاوپێچەکان.',
      noMessagesChat: 'هێشتا هیچ پەیامێک لەم گفتوگۆیەدا نییە. پرسیارێک بنووسە یان فایلێک بنێرە.',
      replyPlaceholder: 'وەڵامەکەت بۆ ئەم قوتابییە بنووسە...',
      askPlaceholder: 'پرسیارێک لە م. کەسرەوان بکە...',
      sending: 'ناردن...',
      send: 'ناردن',
      download: 'دابەزاندن',
      onlineLabel: 'لە هێڵدایە',
      offlineLabel: 'دەرەوەی هێڵ',
    },
    notifications: {
      title: 'ئاگادارکردنەوەکان',
      unreadLabel: 'ئاگاداری نەخوێندراوە',
      pushActive: 'ئاگاداری دەرەکی چالاکە (ناچالاککردن)',
      enablePush: 'چالاککردنی ئاگاداری دەرەکی (Push)',
      enablingPush: 'چالاککردن...',
      markAllRead: 'نیشانکردنی هەمووی وەک خوێندراوە',
      allCaughtUp: 'هەموو ئاگادارییەکانت خوێندووەتەوە',
      emptyDesc: 'ڕاگەیاندنەکان، پرسیارە نوێیەکان، فایلەکان و وەڵامەکانی مامۆستا لێرە دەردەکەون.',
      unreadTag: 'نەخوێندراوە',
      categories: {
        announcement: 'ڕاگەیاندن',
        question: 'پرسیار',
        chapter: 'بەش',
        material: 'مەلزەمە',
        reply: 'وەڵام',
      },
    },
    notifPrompt: {
      title: 'ڕێگە بە ناوەندی پۆلی ٩ دەدەیت ئاگادارکردنەوەت بۆ بنێرێت؟',
      subtitle: 'ئاگاداری وەربگرە بۆ ڕاگەیاندنەکان، پرسیارە نوێیەکان و وەڵامەکانی م. کەسرەوان.',
      allow: 'ڕێگەپێدان',
      dontAllow: 'ڕێگەمەدە',
      bannerTitle: 'ئاگاداری پۆلی ٩ بەدەستبهێنە',
      bannerDesc: 'ئاگادارکردنەوە چالاک بکە بۆ وەرگرتنی ڕاگەیاندن، پرسیارە نوێیەکان و وەڵامەکان.',
      bannerEnableBtn: 'چالاککردنی ئاگادارکردنەوە',
      bannerDismissLabel: 'داخستنی بانەری ئاگادارکردنەوە',
    },
    aiStudio: {
      title: 'ستۆدیۆی زیرەکی زانست',
      subtitle: 'مامۆستای زیرەکی خوێندن بە Gemini و دروستکەری وێنەی زانستی بە کوالێتی بەرز (1K, 2K, 4K).',
      tutorChatTab: 'چاتی مامۆستای زیرەک',
      diagramTab: 'دروستکەری هێڵکاری و وێنە',
      modelLabel: 'مۆدێلی Gemini',
      rolePresetLabel: 'ڕۆڵی مامۆستای زیرەک',
      systemInstructionLabel: 'ڕێنمایی سیستەم',
      clearHistory: 'سڕینەوەی مێژووی گفتوگۆ',
      threadTitle: 'گفتوگۆی خوێندن',
      emptyTitle: 'پرسیارێکی زانستی پۆلی ٩ بکە',
      emptyDesc: 'گفتوگۆکە بیرەوەری تەواوی هەیە بۆ وەڵامدانەوەی پرسیارە یەک لە دوای یەکەکان لەسەر یاسا و هاوکێشە زانستییەکان.',
      thinking: 'بیرکردنەوە...',
      chatPlaceholder: 'پرسیار بکە لەسەر ئیش، توانا، وزەی جووڵە، گەرمی...',
      send: 'ناردن',
      retry: 'دووبارە هەوڵبدە',
      stop: 'وەستاندن',
      diagramTitle: 'دروستکەری هێڵکاری بە کوالێتی بەرز',
      diagramSub: 'کار دەکات بە بزوێنەری هێڵکاری Gemini 4 Hydrogen بە کوالێتی هەڵبژاردراوی 1K، 2K، و 4K.',
      diagramPromptLabel: 'وەسفی هێڵکاری یان وێنەکە',
      diagramPlaceholder: 'نموونە: هێڵکارییەکی زانستی ڕوون بۆ شکانەوەی ڕووناکی لە پەڕەشووشەی سێگۆشەدا',
      resolutionLabel: 'کوالێتی وێنە',
      aspectRatioLabel: 'ڕێژەی لایەکان',
      generateBtn: 'دروستکردنی وێنەی {size}',
      generatingBtn: 'دروستکردنی هێڵکاری {size}...',
      noVisualsTitle: 'هێشتا هیچ وێنەیەک دروست نەکراوە',
      noVisualsDesc: 'چەمکێکی زانستی یان ئامێرێکی سادە وەسف بکە و کوالێتی 1K، 2K یان 4K هەڵبژێرە.',
      download: 'دابەزاندن',
      models: {
        hydrogen: 'Gemini 4 Hydrogen (ئەرکە گشتییەکان)',
        flashLite: 'Gemini 3.1 Flash Lite (وەڵامی خێرا)',
        argon: 'Gemini 4 Argon (زانستی پێشکەوتوو)',
        carbon: 'Gemini 4 Carbon (شیکاری قووڵ)',
      },
      roles: {
        physicsTutorLabel: 'مامۆستای چەمکە زانستییەکان',
        physicsTutorInstruction:
          'تۆ مامۆستایەکی پوخت و ڕوونی زانستی پۆلی ٩یت. بە کوردی یاسا و نموونەیەکی کورت ڕوون بکەرەوە و هێمای یەکە زانستییەکان بە لاتینی بهێڵەرەوە (N, kg, m, s, m/s, J, W, Hz, Pa, °C, K).',
        stepSolverLabel: 'شیکارکەری هەنگاو بە هەنگاو',
        stepSolverInstruction:
          'تۆ شیکارکەری پرسیارەکانی زانستی پۆلی ٩یت. دراوەکان و یاسا و هەنگاوەکان بە کوردی و کورتی بنووسە و یەکە لاتینییەکان بپارێزە (N, kg, m, s, m/s, J, W, Hz, Pa, °C, K).',
        labCoachLabel: 'ڕاهێنەری تاقیگە و تاقیکردنەوە',
        labCoachInstruction:
          'تۆ ڕاهێنەری تاقیگەی زانستی پۆلی ٩یت. بە کوردی و کورتی یارمەتی دیزاینی تاقیکردنەوە و دیاریکردنی گۆڕاوەکان بدە.',
      },
    },
    profile: {
      title: 'پڕۆفایل و پێشکەوتن',
      subtitle: 'وێنەی پڕۆفایل، زانیاری هەژمار و مێژووی تاقیکردنەوەکانت بەڕێوەببە.',
      mainAdminLabel: 'بەڕێوەبەری سەرەکی و مامۆستا',
      teacherAccount: 'هەژماری مامۆستا',
      studentAccount: 'هەژماری قوتابی',
      adminBadge: 'بەڕێوەبەر',
      fullName: 'ناوی تەواو',
      birthdayLabel: 'ڕۆژی لەدایکبوون',
      gradeFocus: 'پۆل / بابەت',
      bio: 'کورتەناساندن',
      avatarTitle: 'وێنەی پڕۆفایل',
      avatarDesc: 'وێنەیەکی کەسی باربکە بۆ نیشاندانی لە پڕۆفایل و گفتوگۆکاندا.',
      uploadAvatar: 'بارکردنی وێنە',
      changeAvatar: 'گۆڕینی وێنە',
      removeAvatar: 'لابردنی وێنە',
      uploadingAvatar: 'بارکردن...',
      avatarUpdatedMsg: 'وێنەی پڕۆفایل نوێکرایەوە.',
      avatarRemovedMsg: 'وێنەی پڕۆفایل لابرا.',
      changePasswordOpt: 'گۆڕینی وشەی نهێنی (ئارەزوومەندانە)',
      currentPassPlaceholder: 'وشەی نهێنی ئێستا',
      newPassPlaceholder: 'وشەی نهێنی نوێ (٦+ پیت)',
      saveChanges: 'پاشەکەوتکردنی گۆڕانکارییەکان',
      saving: 'پاشەکەوتکردن...',
      pushTitle: 'ئاگادارکردنەوەی دەرەکی (Push)',
      pushDesc: 'ئاگاداری دەستبەجێ وەربگرە بۆ ڕاگەیاندن و پرسیارە نوێیەکان و وەڵامەکانی مامۆستا.',
      disablePush: 'ناچالاککردن',
      enablePush: 'چالاککردن',
      recentAttempts: 'دوایین تاقیکردنەوەکان',
      noAttempts: 'هێشتا هیچ تاقیکردنەوەیەک تۆمار نەکراوە.',
      allChaptersCombined: 'هەموو بەشەکان پێکەوە',
      generalQuestionsLabel: 'پرسیارە گشتییەکان',
      adminControlsTitle: 'کۆنتڕۆڵی بەڕێوەبەر · هەژمارە تۆمارکراوەکان',
      adminControlsDesc: 'بەڕێوەبەری سەرەکی دەتوانێت بەشەکان و پرسیارەکان و ڕاگەیاندنەکان و دەسەڵاتی هەژمارەکان بەڕێوەببات.',
      accountsCount: 'هەژمار',
      loadingAccounts: 'بارکردنی هەژمارەکان...',
      noAccounts: 'هیچ هەژمارێک نەدۆزرایەوە.',
      mainAdminTag: 'بەڕێوەبەری سەرەکی',
      adminTeacherTag: 'بەڕێوەبەر / مامۆستا',
      studentTag: 'قوتابی',
      setStudent: 'کردن بە قوتابی',
      makeAdmin: 'کردن بە بەڕێوەبەر',
      confirm: 'دڵنیاکردنەوە',
      cancel: 'پاشگەزبوونەوە',
      updatedMsg: 'پڕۆفایلەکەت بە سەرکەوتوویی نوێکرایەوە.',
      roleUpdatedMsg: 'دەسەڵاتی {name} گۆڕدرا بۆ {role}.',
      accountRemovedMsg: 'هەژمارەکە سڕایەوە.',
      cropModalTitle: 'بڕین و ڕێکخستنی وێنەی پڕۆفایل',
      cropModalSub: 'پێش پاشەکەوتکردن وێنەکە بجوڵێنە، گەورەی بکە یان بیسووڕێنە (256×256).',
      zoomLabel: 'گەورەکردن',
      rotateBtn: 'سووڕاندن ٩٠°',
      resetCropBtn: 'ڕێکخستنەوە',
      applyCropUploadBtn: 'بڕین و بارکردن',
      invalidImageType: 'تکایە وێنەیەکی PNG یان JPG یان WebP یان GIF هەڵبژێرە.',
      imageTooLarge: 'قەبارەی وێنەکە دەبێت لە 15 MB کەمتر بێت.',
      dangerZoneTitle: 'ناوچەی مەترسیدار · سڕینەوەی هەژمار',
      dangerZoneDesc: 'هەژمارەکەت، مێژووی تاقیکردنەوەکان، پۆستەکان، نامەکان و خاڵەکانی پێشبڕکێ بە تەواوی بسڕەوە. ئەم کردارە گەڕانەوەی نییە.',
      deleteAccountBtn: 'سڕینەوەی هەژمارەکەم',
      deleteAccountModalTitle: 'دڵنیایت لە سڕینەوەی یەکجارەکی هەژمارەکەت؟',
      deleteAccountWarning: 'هەموو تاقیکردنەوەکانت، خاڵەکانی پێشبڕکێ، گفتوگۆکانی مامۆستا و نامەکان بە یەکجاری دەسڕدرێنەوە و دەستبەجێ دەردەچیت.',
      deleteAccountTypeLabel: 'وشەی DELETE بنووسە بۆ دڵنیابوون لە سڕینەوەی یەکجاری',
      deleteAccountPlaceholder: 'DELETE بنووسە',
      confirmDeleteAccountBtn: 'سڕینەوەی هەژمار بۆ هەمیشە',
      deletingAccount: 'سڕینەوەی هەژمار...',
      protectedAdminDeleteNote: 'هەژماری بەڕێوەبەری سەرەکی ناتوانرێت بسڕدرێتەوە بۆ پاراستنی بەردەوامیی سیستەم.',
      refreshAccountsBtn: 'نوێکردنەوە',
      searchAccountsPlaceholder: 'گەڕان لە هەژمارەکان بە ناو، ئیمەیڵ یان پۆل...',
      filterAllAccounts: 'هەموو',
      filterStudentsOnly: 'قوتابیان',
      filterAdminsOnly: 'بەڕێوەبەر / مامۆستا',
      filterOnlineOnly: 'لە هێڵدایە',
      filterRestrictedOnly: 'سنووردارکراو',
      inspectEditBtn: 'پشکنین / دەستکاری',
      inspectModalTitle: 'پشکنین و دەستکاریکردنی هەژمار',
      accountUpdatedMsg: 'پڕۆفایلی هەژماری {name} نوێکرایەوە.',
      roleLabel: 'ڕۆڵی هەژمار',
      sourceLabel: 'سەرچاوەی تۆمار',
      joinedLabel: 'بەرواری تۆمار',
      loadAccountsError: 'بارکردنی هەژمارە تۆمارکراوەکان سەرکەوتوو نەبوو.',
    },
    settings: {
      title: 'ڕێکخستنەکانی سیستەم و خوێندن',
      subtitle: 'ڕووکار، قەبارەی فۆنت، زمان و شێوازی تاقیکردنەوەکان بۆ زانستی پۆلی ٩ ڕێکبخە.',
      appearanceTitle: 'دۆخی ڕووکار (Theme)',
      appearanceDesc: 'دۆخی سپی (ڕووناک)، تاریک، یان خۆکار (بەپێی سیستەمی ئامێرەکەت) هەڵبژێرە.',
      themeLabel: 'شێوازی ڕەنگ',
      themeLight: 'سپی (ڕووناک)',
      themeLightDesc: 'ڕووکارێکی کاغەزی سپی گونجاو بۆ ڕۆژ و ڕووناکی.',
      themeDark: 'تاریک',
      themeDarkDesc: 'ڕووکارێکی تاریک و ئارام بۆ خوێندنی شەوانە.',
      themeAuto: 'خۆکار (Auto)',
      themeAutoDesc: 'بە شێوەیەکی خۆکار لەگەڵ دۆخی مۆبایل یان کۆمپیوتەر دەگونجێت.',
      activeModeResolved: 'دۆخی کارپێکراوی ئێستا',
      fontSizeLabel: 'قەبارەی فۆنت (نووسین)',
      fontSizeDesc: 'قەبارەی نووسینی پرسیار، وەڵام و هەموو شاشەکان بگۆڕە.',
      fontSmall: 'بچووک',
      fontNormal: 'ئاسایی',
      fontLarge: 'گەورە',
      fontXLarge: 'زۆر گەورە',
      fontPreviewLabel: 'نموونەی قەبارەی نووسین',
      fontPreviewSample: 'زانستی پۆلی ٩: وزە لەناوناچێت، بەڵکو لە شێوەیەکەوە دەگۆڕێت بۆ شێوەیەکی تر.',
      languageTitle: 'زمانی بەرنامە و پڕۆگرام',
      languageDesc: 'تەواوی مینیو و ١١ بەشەکە و پرسیار و ڕوونکردنەوەکان بگۆڕە بۆ کوردی، عەرەبی یان ئینگلیزی.',
      preferencesTitle: 'هەڵبژاردەکانی خوێندن و ئاسانکاری',
      preferencesDesc: 'دەنگی وەڵامدانەوە، گەڕانەوەی خۆکار بۆ ڕوونکردنەوە و جووڵەی پەڕەکان ڕێکبخە.',
      soundFeedbackLabel: 'دەنگی ئاگادارکردنەوەی وەڵام',
      soundFeedbackDesc: 'لێدانی دەنگێکی نەرم کاتێک وەڵامێک دەپشکنرێت.',
      autoScrollLabel: 'چوونی خۆکار بۆ ڕوونکردنەوە',
      autoScrollDesc: 'دوای هەڵبژاردنی وەڵام پەڕەکە بەرەو ڕوونکردنەوە و دوگمەی پرسیاری داهاتوو دەجوڵێنێت.',
      reduceMotionLabel: 'کەمکردنەوەی جووڵە و ئەنیمەیشن',
      reduceMotionDesc: 'کەمکردنەوەی ئەنیمەیشنەکان بۆ خوێندنەوەیەکی خێراتر و هێمنتر.',
      notificationsTitle: 'ئاگادارکردنەوەکانی سیستەم',
      notificationsDesc: 'بەڕێوەبردنی ئاگاداری دەرەکی بۆ بەشە نوێیەکان و پرسیارەکان و وەڵامی مامۆستا.',
      notificationsStatusEnabled: 'چالاکە',
      notificationsStatusDisabled: 'ناچالاکە',
      notificationsStatusBlocked: 'لە ڕێکخستنی وێبگەڕ بلۆک کراوە',
      notificationsBlockedHelp: 'ئاگادارکردنەوەکان لە ئێستادا لەلایەن وێبگەڕ یان ئامێرەکەتەوە بلۆک کراون. ڕێکخستنی مۆڵەتەکانی ماڵپەڕ بکەرەوە (ئایکۆنی قوفڵ لە سەرەوە یان ڕێکخستنی ئەپ لە مۆبایلدا) و Notifications بکە بە Allow، پاشان دووبارە چالاککردن داگرە.',
      openNotificationsBtn: 'کردنەوەی ڕێکخستنی ئاگاداری',
      resetDefaults: 'گەڕاندنەوەی هەموو ڕێکخستنەکان بۆ سەرەتایی',
      resetDone: 'هەموو ڕێکخستنەکان گەڕێندرانەوە باری سەرەتایی.',
      accentThemeTitle: 'تیم و ڕەنگی سەرەکی',
      accentThemeDesc: 'ڕەنگی سەرەکی بەرنامە بۆ مینیو، دوگمەکان و نیشانەکان بگۆڕە.',
      accentActiveLabel: 'ڕەنگی ئێستا',
      accentPreviewBtn: 'نموونەی دوگمە',
      accentColors: {
        burgundy: 'سووری تۆخ',
        indigo: 'نیلی (Indigo)',
        emerald: 'زمڕووت (Emerald)',
        violet: 'مۆر (Violet)',
        blue: 'شین (Blue)',
        rose: 'گوڵی (Rose)',
        amber: 'زەردی گەرم (Amber)',
      },
    },
    about: {
      kicker: 'دەربارەی مامۆستا و گەشەپێدەر',
      name: 'کەسرەوان محەمەد',
      roleLine: 'مامۆستای زانستی پۆلی ٩ | گەشەپێدەری وێب',
      bioP1:
        'کەسرەوان محەمەد مامۆستای زانستی پۆلی ٩ و گەشەپێدەری وێبە کە پابەندە بە گۆڕینی شێوازی فێربوونی قوتابیان بۆ تێگەیشتنی یاسا زانستییەکان و شیکارکردنی پرسیارەکان.',
      bioP2:
        'بە تێکەڵکردنی وانەوتنەوەی زانست لە پۆلدا لەگەڵ ئەندازیاری وێبی مۆدێرن، ئەپڵیکەیشنی کارلێکەر دروست دەکات بۆ ئەوەی قوتابیان هەمیشە بەستراوبن بە تاقیکردنەوەی بەشەکان و ڕێنمایی مامۆستا.',
      pillar1Title: 'پەروەردەی زانست',
      pillar1Desc: 'ڕوونکردنەوەی چەمکەکان بە وردی لە میکانیک، ئامێرە سادەکان، وزە، گەرمی و زانستی پۆلی ٩.',
      pillar2Title: 'ئەپە فێرکارییەکان',
      pillar2Desc: 'ئەپی مۆبایل و کۆمپیوتەر کە دەتوانرێت دابەزێنرێت بۆ خوێندنی ڕۆژانە.',
      pillar3Title: 'تەکنەلۆژیا و زانست',
      pillar3Desc: 'بەستنەوەی تاقیکردنەوەی دەستبەجێ و ڕوونکردنەوە بە پاڵپشتی ڕاستەوخۆ.',
    },
    admin: {
      title: 'داشبۆردی بەڕێوەبەر و چاودێری ڕاستەوخۆ',
      subtitle: 'گەڕان لە ناو قوتابیان، پرسیارەکان، بەشەکان و پەیامەکان، بینینی قوتابیانی ئێستا لە هێڵدا، و پلەبەندی خۆکار.',
      liveSyncLabel: 'هاوکاتکردنی ڕاستەوخۆ چالاکە',
      refreshBtn: 'نوێکردنەوە',
      privacyNote: 'پاراستنی نهێنی: چاودێریکردن تەنها سنووردارە بە چالاکی فێرکاری ناو بەرنامەکە (تاقیکردنەوە، پرسیارە وەڵامدراوەکان، پرسیار لە مامۆستا و ستۆدیۆی زیرەک).',
      searchPlaceholder: 'گەڕان بۆ قوتابیان، پرسیارەکان، بەشەکان و پەیامەکان بە ناو یان وشەی سەرەکی...',
      searchClear: 'سڕینەوە',
      searching: 'گەڕان لە ناو ناوەندی پۆلی ٩...',
      searchEmpty: 'هیچ قوتابی، پرسیار، بەش یان پەیامێکی هاوشێوە نەدۆزرایەوە.',
      filterAll: 'هەموو ئەنجامەکان',
      filterStudents: 'قوتابیان',
      filterQuestions: 'پرسیارەکان',
      filterChapters: 'بەشەکان',
      filterMessages: 'پەیامەکان',
      activeStudentsTitle: 'قوتابیانی ئێستا لە هێڵدا (چالاک)',
      activeStudentsSub: 'ئەو قوتابییانەی ئێستا بە شێوەی ڕاستەوخۆ وێبسایتەکە بەکاردەهێنن.',
      onlineNowBadge: 'ئێستا لە هێڵدا',
      onlineLabel: 'لە هێڵدایە',
      offlineLabel: 'دەرەوەی هێڵ',
      noActiveStudents: 'لە ئێستادا هیچ قوتابییەک لە هێڵدا نییە.',
      viewingSection: 'لە بەشی',
      topStudentTitle: 'باشترین قوتابی (Top Student)',
      topStudentSub: 'بە شێوەی خۆکار هەڵدەبژێردرێت بەپێی نمرەی تاقیکردنەوەکان، وەڵامە ڕاستەکان و وردبینی.',
      noTopStudent: 'دوای وەڵامدانەوەی پرسیارەکان یان تاقیکردنەوەکان پلەبەندی دەردەکەوێت.',
      mostActiveTitle: 'چالاکترین قوتابی (Most Active)',
      mostActiveSub: 'بە شێوەی خۆکار دیاری دەکرێت بەپێی بەشداریکردنی بەردەوام لە تاقیکردنەوە و فێربووندا.',
      noMostActive: 'دوای چالاکی خوێندنی قوتابیان ئەم بەشە دەردەکەوێت.',
      leaderboardTitle: 'ئامار و پلەبەندی هەموو قوتابیان',
      leaderboardSub: 'نوێکردنەوەی خۆکار لە کاتی بەکارهێنانی پلاتفۆرمەکە لەلایەن قوتابیانەوە.',
      noStudentsYet: 'هێشتا هیچ هەژمارێکی قوتابی تۆمار نەکراوە.',
      quizzesCompleted: 'تاقیکردنەوە',
      questionsAnswered: 'وەڵامدراو',
      correctAnswers: 'ڕاست',
      accuracyLabel: 'وردبینی',
      avgScore: 'تێکڕای نمرە',
      bestScore: 'بەرزترین نمرە',
      performanceScore: 'نمرەی ئەنجام',
      activityPoints: 'خاڵی چالاکی',
      teacherQuestions: 'پرسیار بۆ مامۆستا',
      aiTutorTurns: 'گفتوگۆی AI',
      lastActive: 'دوایین چالاکی',
      viewStatsBtn: 'بینینی وردەکاری',
      messageBtn: 'نامە',
      openChapterBtn: 'کردنەوەی بەش',
      openChatBtn: 'کردنەوەی گفتوگۆ',
      statsModalTitle: 'ئاماری وردی فێرکاری قوتابی',
      recentAttemptsTitle: 'دوایین تاقیکردنەوە تۆمارکراوەکان',
      noStudentAttempts: 'ئەم قوتابییە هێشتا هیچ تاقیکردنەوەیەکی تەواو تۆمار نەکردووە.',
      closeBtn: 'داخستن',
      lastLogin: 'دوایین چوونەژوورەوە',
      restrictedBadge: 'سنووردارکراو',
      restrictBtn: 'سنووردارکردن',
      unrestrictBtn: 'لابردنی سنووردارکردن',
      restrictPromptTitle: 'سنووردارکردنی پەیوەندی قوتابی',
      restrictReasonPlaceholder: 'هۆکاری سنووردارکردن بنووسە (بۆ نموونە وشەی نەشیاو یان سپام)...',
      confirmRestrictBtn: 'جێگیرکردنی سنووردارکردن',
      deleteUserBtn: 'سڕینەوەی هەژمار',
      deleteUserModalTitle: 'هەژمارەکە بۆ هەمیشە بسڕدرێتەوە؟',
      deleteUserModalWarning: 'ئەم کردارە هەژمارەکە بە یەکجاری دەسڕێتەوە، هەموو دانیشتنە چالاکەکان دەستبەجێ دادەخات، و تاقیکردنەوە، خاڵ، نامە و پۆستەکان دەسڕێتەوە.',
      confirmDeleteUserBtn: 'سڕینەوەی یەکجاری هەژمار',
      deletingUserBtn: 'سڕینەوە...',
      userDeletedSuccess: 'هەژماری {name} بە تەواوی سڕایەوە و دانیشتنە چالاکەکانی داخران.',
      cannotDeleteSelf: 'ناتوانیت هەژماری چالاکی خۆت لە داشبۆردی بەڕێوەبەرەوە بسڕیتەوە.',
      cannotDeleteMainAdmin: 'هەژماری بەڕێوەبەری سەرەکی ناتوانرێت بسڕدرێتەوە.',
      monitoringTitle: 'چاودێری کۆمەڵگا، تۆماری چالاکی و سەلامەتی',
      monitoringSub: 'پشکنینی هەموو نامە تایبەتەکان، گرووپ چاتەکان، کاتی چوونەژوورەوەی قوتابیان و ڕاپۆرتەکان.',
      tabOverview: 'پوختە',
      tabPrivateDms: 'نامە تایبەتەکان',
      tabGroupChats: 'گرووپ چاتەکان',
      tabActivityLogs: 'تۆماری چالاکی',
      tabModeration: 'سەلامەتی و ڕاپۆرتەکان',
      statPosts: 'پۆستەکان',
      statComments: 'لێدوانەکان',
      statReactions: 'کاردانەوەکان',
      statPrivateDms: 'نامە تایبەتەکان',
      statGroups: 'گرووپەکان',
      statGroupMsgs: 'نامەکانی گرووپ',
      statOpenReports: 'ڕاپۆرتە کراوەکان',
      statRestrictedUsers: 'هەژمارە سنووردارکراوەکان',
      searchDmsPlaceholder: 'گەڕان لە نامە تایبەتەکان بە ناوی قوتابی یان دەق...',
      noDmConversations: 'هێشتا هیچ گفتوگۆیەکی تایبەت تۆمار نەکراوە.',
      selectDmConversation: 'گفتوگۆیەکی تایبەت هەڵبژێرە بۆ بینینی هەموو نامەکان.',
      messagesCountLabel: 'نامە',
      deleteMsgBtn: 'سڕینەوە',
      deleteGroupBtn: 'سڕینەوەی گرووپ',
      noGroupsFound: 'هێشتا هیچ گرووپێک دروست نەکراوە.',
      selectGroupInspect: 'گرووپێک هەڵبژێرە بۆ بینینی نامەکان و ئەندامەکان.',
      privateGroupBadge: 'گرووپی تایبەت',
      publicGroupBadge: 'گرووپی گشتی',
      searchLogsPlaceholder: 'فلتەرکردنی تۆمارەکان بە ناوی قوتابی یان وردەکاری...',
      allActionsFilter: 'هەموو چالاکییەکان',
      noLogsFound: 'هیچ تۆمارێکی چالاکی نەدۆزرایەوە.',
      filterOpen: 'کراوە',
      filterResolved: 'چارەسەرکراو',
      filterDismissed: 'پشتگوێخراو',
      noReportsFound: 'هیچ ڕاپۆرتێکی سەلامەتی لەم بەشەدا نییە.',
      reportedBy: 'ڕاپۆرتکراو لەلایەن',
      reportedTarget: 'ئامانج',
      reportedReason: 'هۆکار',
      deleteReportedContent: 'سڕینەوەی ناوەڕۆک',
      resolveBtn: 'چارەسەرکرا',
      dismissBtn: 'پشتگوێخستن',
      statusOpen: 'کراوە',
      statusResolved: 'چارەسەرکراو',
      statusDismissed: 'پشتگوێخراو',
      actionLabels: {
        login: 'چوونەژوورەوە',
        register: 'تۆمارکردنی هەژمار',
        logout: 'چوونەدەرەوە',
        online: 'لە هێڵدا بوو',
        offline: 'دەرەوەی هێڵ',
        post_created: 'بڵاوکردنەوەی پۆست',
        post_deleted: 'سڕینەوەی پۆست',
        comment_created: 'نووسینی لێدوان',
        reaction_added: 'کاردانەوە',
        dm_sent: 'ناردنی نامەی تایبەت',
        group_created: 'دروستکردنی گرووپ',
        group_joined: 'چوونە ناو گرووپ',
        group_message_sent: 'نامەی گرووپ',
        quiz_completed: 'تەواوکردنی تاقیکردنەوە',
        question_answered: 'وەڵامدانەوەی پرسیار',
        teacher_message_sent: 'نامە بۆ مامۆستا',
        ai_tutor_used: 'بەکارهێنانی AI',
        content_reported: 'ناردنی ڕاپۆرت',
        content_deleted: 'سڕینەوەی ناوەڕۆک',
        account_restricted: 'سنووردارکردنی هەژمار',
        account_unrestricted: 'لابردنی سنووردارکردن',
        report_reviewed: 'پێداچوونەوەی ڕاپۆرت',
      },
      tabBackups: 'پاشەکەوت و گەڕاندنەوە',
      backupTitle: 'پاراستنی بنکەی زانیاری، پاشەکەوت و گەڕاندنەوە',
      backupSub: 'پاشەکەوتکردنی خۆکار پێش گۆڕانکارییەکان و دابەزاندن/گەڕاندنەوەی هەموو هەژمارەکان، وشەی نهێنی، نمرەکان، بەشەکان، تاقیکردنەوەکان و نامەکان.',
      backupProtectionBadge: 'پاراستنی خۆکار چالاکە',
      backupStatsAccounts: 'هەژمارە پارێزراوەکان',
      backupStatsQuestions: 'پرسیارەکان',
      backupStatsMessages: 'نامەکان',
      backupStatsAttempts: 'تاقیکردنەوەکان',
      backupStatsDbSize: 'قەبارەی فایل',
      backupLastSnapshot: 'دوایین پاشەکەوتی خۆکار',
      createBackupBtn: 'دروستکردنی پاشەکەوت ئێستا',
      creatingBackup: 'پاشەکەوت دەکرێت...',
      downloadExportBtn: 'داگرتنی تەواوی بنکەی زانیاری (.json)',
      importBackupBtn: 'گەڕاندنەوە لە فایلەوە (.json)',
      restoreModeLabel: 'شێوازی گەڕاندنەوە',
      restoreModeMerge: 'تێکەڵکردنی پارێزراو (پاراستنی هەژمارە نوێیەکان و گەڕاندنەوەی ونبووەکان)',
      restoreModeReplace: 'جێگۆڕکێی تەواو (گەڕاندنەوەی تەواو بۆ ئەم وێنەیە دوای پاشەکەوت)',
      restoreBtn: 'گەڕاندنەوە',
      downloadFileBtn: 'داگرتن',
      deleteBackupBtn: 'سڕینەوە',
      latestSnapshotBadge: 'وێنەی گەڕاندنەوەی خۆکار',
      noBackupsYet: 'هێشتا هیچ پاشەکەوتێک نییە.',
      backupCreatedMsg: 'پاشەکەوتی بنکەی زانیاری بە سەرکەوتوویی دروستکرا.',
      backupRestoredMsg: 'پاشەکەوت بە سەرکەوتوویی گەڕێندرایەوە لەگەڵ پاراستنی مۆڵەتی بەڕێوەبەر.',
      backupConfirmReplace: 'جێگۆڕکێی تەواو زانیارییەکان دەگەڕێنێتەوە بۆ ئەم کاتە دوای دروستکردنی پاشەکەوتی سەلامەتی. بەردەوام بیت؟',
      aiDisabledNotice: 'ستۆدیۆی زیرەکی دەستکرد لە ئێستادا لەلایەن بەڕێوەبەرەوە وەستێنراوە.',
      tabAccounts: 'هەژمارە تۆمارکراوەکان',
      tabContentControl: 'ناوەڕۆک و پرۆگرام',
      tabAppSettings: 'ڕێکخستنەکانی بەرنامە',
      registeredAccountsSub: 'پشکنینی هەموو هەژمارەکانی قوتابی و مامۆستا، دەستکاریکردنی پڕۆفایل، بەڕێوەبردنی دەسەڵات، سنووردارکردن یان سڕینەوەی هەژمارەکان.',
      editProfileBtn: 'دەستکاری پڕۆفایل',
      saveProfileBtn: 'پاشەکەوتکردنی گۆڕانکارییەکان',
      contentControlTitle: 'کۆنتڕۆڵی پرۆگرام، تاقیکردنەوە و ڕاگەیاندنەکان',
      contentControlSub: 'ڕاستەوخۆ بچۆ ناو دەستکاریکردنی هەر بەشێکی زانستی پۆلی ٩، پرسیاری تاقیکردنەوە، پرسیارە گشتییەکان، کتێب یان ڕاگەیاندن.',
      openQuizzesBtn: 'دەستکاری تاقیکردنەوەی بەشەکان',
      openGeneralQaBtn: 'دەستکاری پرسیارە گشتییەکان',
      openTextbooksQaBtn: 'دەستکاری کتێب و پرسیارەکان',
      openHomeAnnouncementsBtn: 'بەڕێوەبردنی ڕاگەیاندنەکان',
      appSettingsTitle: 'ڕێکخستنە گشتییەکانی بەرنامە و کۆنتڕۆڵی دەستڕاگەیشتن',
      appSettingsSub: 'ڕێکخستنی تۆمارکردنی قوتابی، کۆمەڵگا، ستۆدیۆی زیرەک، زمانی سەرەکی و ئاگاداری سەرتاسەری.',
      settingAllowReg: 'ڕێگەپێدان بە تۆمارکردنی قوتابی نوێ',
      settingCommunityEnabled: 'چالاککردنی کۆمەڵگەی قوتابیان بۆ قوتابیان',
      settingCommunityPosting: 'ڕێگەپێدان بە پۆست، لێدوان و نامەی قوتابیان',
      settingAiTutor: 'چالاککردنی ستۆدیۆی AI بۆ قوتابیان',
      settingDefaultLang: 'زمانی سەرەکی',
      settingMaintenanceMsg: 'ئاگاداری سەرتاسەری لە ناو بەرنامە (ئارەزوومەندانە)',
      settingMaintenancePlaceholder: 'بە بەتاڵی جێیبهێڵە یان ئاگادارییەک بنووسە بۆ هەموو بەکارهێنەران...',
      saveSettingsBtn: 'پاشەکەوتکردنی ڕێکخستنەکان',
      settingsSavedMsg: 'ڕێکخستنەکانی بەرنامە پاشەکەوت کران و جێبەجێکران.',
    },
    community: {
      title: 'کۆمەڵگەی قوتابیان',
      subtitle: 'پەیوەندی بە هاوپۆلە چالاکەکان بکە، پۆستی زانستی بڵاوبکەرەوە، نامەی تایبەت بنێرە و لە گرووپەکاندا گفتوگۆ بکە.',
      privacyBannerTitle: 'ئاگاداری سەلامەتی و پاراستنی نهێنی',
      privacyBannerDesc: 'هەموو پۆستەکان، لێدوانەکان، نامە تایبەتەکان، گرووپ چاتەکان و چالاکییەکان لە کۆمەڵگەی قوتابیان بە پارێزراوی تۆمار دەکرێن و دەکرێت لەلایەن بەڕێوەبەری قوتابخانە (م. کەسرەوان)ەوە پشکنینیان بۆ بکرێت بۆ پاراستنی سەلامەتی قوتابیان.',
      restrictedBannerTitle: 'مۆڵەتەکانی کۆمەڵگا سنووردارکراون',
      restrictedBannerDefault: 'توانای بڵاوکردنەوە و ناردنی نامەت لە کۆمەڵگەی قوتابیان لەلایەن بەڕێوەبەرەوە سنووردار کراوە.',
      tabFeed: 'پۆستە فێرکارییەکان',
      tabActiveStudents: 'قوتابیانی چالاک',
      tabPrivateMessages: 'نامە تایبەتەکان',
      tabGroupChats: 'گرووپ چاتەکان',
      onlineNowCount: 'ئێستا لە هێڵدا',
      activeClassmatesTitle: 'قوتابیان و هاوپۆلە چالاکەکان',
      activeClassmatesSub: 'ببینە کێ ئێستا لە هێڵدایە لە ناوەندی پۆلی ٩ و گفتوگۆ دەستپێبکە.',
      onlineStatus: 'لە هێڵدایە',
      offlineStatus: 'دەرەوەی هێڵ',
      studyingLabel: 'لە بەشی',
      messagePeerBtn: 'نامە',
      reportUserBtn: 'ڕاپۆرت',
      noPeersFound: 'هێشتا هیچ هاوپۆلێک تۆمار نەکراوە.',
      sharePlaceholder: 'تێبینیەکی زانستی پۆلی ٩، یاسا، وێنە یان پرسیار لەگەڵ هاوپۆلەکانت هاوبەش بکە...',
      chapterTagOptional: 'دیاریکردنی بەش (ئارەزوومەندانە)',
      noChapterTag: 'زانستی گشتی',
      attachFileBtn: 'هاوپێچکردنی وێنە / فایل',
      publishPostBtn: 'بڵاوکردنەوەی پۆست',
      publishingPost: 'بڵاودەکرێتەوە...',
      searchPostsPlaceholder: 'گەڕان لە پۆستەکان یان ناوی هاوپۆل...',
      allChaptersFilter: 'هەموو بەشەکان',
      noPostsYet: 'هێشتا هیچ پۆستێکی فێرکاری نییە. ببە یەکەم کەس!',
      commentsLabel: 'لێدوانەکان',
      writeCommentPlaceholder: 'لێدوانێکی بەسوود بنووسە...',
      sendCommentBtn: 'ناردن',
      deleteBtn: 'سڕینەوە',
      reportBtn: 'ڕاپۆرت',
      downloadAttachment: 'داگرتنی هاوپێچ',
      reactions: {
        like: 'بەدڵمە',
        helpful: 'بەسوودە',
        celebrate: 'نایابە',
        insightful: 'قووڵە',
      },
      dmThreadsTitle: 'نامەکانی هاوپۆلان',
      searchClassmatesPlaceholder: 'گەڕان بۆ هاوپۆل...',
      selectClassmatePrompt: 'هاوپۆلێک هەڵبژێرە بۆ ناردنی نامەی تایبەتی خوێندن.',
      noDmMessages: 'هێشتا هیچ نامەیەک نییە. سڵاو بنێرە یان پرسیارێکی زانستی بکە!',
      writeDmPlaceholder: 'نامەیەکی تایبەت بنووسە...',
      sendBtn: 'ناردن',
      sendingBtn: 'دەنێردرێت...',
      backToList: 'گەڕانەوە',
      groupsTitle: 'گرووپ چاتی خوێندن',
      createGroupBtn: 'دروستکردنی گرووپ',
      createGroupTitle: 'دروستکردنی گرووپی خوێندن',
      groupNameLabel: 'ناوی گرووپ',
      groupNamePlaceholder: 'نموونە: گرووپی بەشی ٤ وزە',
      groupDescLabel: 'وەسف (ئارەزوومەندانە)',
      groupDescPlaceholder: 'بابەتەکان یان پلانی پێداچوونەوە...',
      groupVisibilityLabel: 'جۆری گرووپ',
      groupPublicOpt: 'گشتی (هەموو قوتابییەک دەتوانێت بێتە ناو)',
      groupPrivateOpt: 'تایبەت (تەنها بانگهێشتکراوەکان و بەڕێوەبەر)',
      selectMembersLabel: 'بانگهێشتکردنی هاوپۆلەکان',
      createGroupSubmit: 'دروستکردنی گرووپ',
      joinGroupBtn: 'چوونە ناو گرووپ',
      leaveGroupBtn: 'دەرچوون',
      deleteGroupBtn: 'سڕینەوەی گرووپ',
      addMemberLabel: 'زیادکردنی هاوپۆل...',
      addMemberBtn: 'زیادکردن',
      membersCount: 'ئەندام',
      selectGroupPrompt: 'گرووپێک هەڵبژێرە یان گرووپێکی نوێ دروست بکە.',
      joinToChatPrompt: 'بۆ ناردنی نامە بچۆ ناو ئەم گرووپە گشتییە.',
      noGroupMessages: 'هێشتا هیچ نامەیەک لەم گرووپەدا نییە.',
      writeGroupMsgPlaceholder: 'نامەیەک بۆ گرووپ بنووسە...',
      reportModalTitle: 'ڕاپۆرتکردنی ناوەڕۆک یان ڕەفتاری نەشیاو',
      reportModalDesc: 'ڕاپۆرتەکان ڕاستەوخۆ بۆ بەڕێوەبەری قوتابخانە (م. کەسرەوان) دەنێردرێن بۆ پێداچوونەوەی خێرا.',
      reportReasonLabel: 'هۆکاری ڕاپۆرتکردن',
      reportReasonPlaceholder: 'ڕوونی بکەرەوە بۆچی ئەم ناوەڕۆکە یان نامەیە نەشیاوە...',
      submitReportBtn: 'ناردنی ڕاپۆرت',
      reportSubmittedMsg: 'ڕاپۆرتی سەلامەتی نێردرا بۆ بەڕێوەبەر.',
      cancelBtn: 'پاشگەزبوونەوە',
      youLabel: 'تۆ',
      teacherBadge: 'بەڕێوەبەر / مامۆستا',
      restrictedUserTag: 'سنووردارکراو',
      filterAllPeers: 'هەموو هاوپۆلەکان',
      filterOnlinePeers: 'لە هێڵدا',
      filterOfflinePeers: 'دەرەوەی هێڵ',
      communityDisabledNotice: 'کۆمەڵگەی قوتابیان لە ئێستادا لەلایەن بەڕێوەبەرەوە ناچالاک کراوە.',
      postingPausedNotice: 'بڵاوکردنەوە و ناردنی نامە لە ئێستادا وەستێنراوە (تەنها خوێندنەوە).',
    },
    competition: {
      title: 'پێشبڕکێ و ڕیزبەندی قوتابیان',
      subtitle: 'ڕیزبەندی قوتابیانی ناوەندی پۆلی ٩ بەپێی تاقیکردنەوە، وەڵامە ڕاستەکان و چالاکی خوێندن.',
      podiumTitle: 'سێ پاڵەوانەکەی پێشەوە',
      podiumSub: 'باشترین قوتابییەکان کە مەدالیای زێڕین، زیوین و بڕۆنزیان بەدەستهێناوە.',
      firstPlace: 'پلەی یەکەم · زێڕین',
      secondPlace: 'پلەی دووەم · زیوین',
      thirdPlace: 'پلەی سێیەم · بڕۆنز',
      yourStandingTitle: 'پلە و خاڵەکانی تۆ',
      rankLabel: 'پلە',
      unrankedLabel: 'پەنجەرەی مامۆستا',
      totalPointsLabel: 'کۆی خاڵەکان',
      quizPointsLabel: 'خاڵی تاقیکردنەوە',
      activityPointsLabel: 'خاڵی چالاکی',
      accuracyLabel: 'وردبینی',
      quizzesLabel: 'تاقیکردنەوە',
      onlineLiveBadge: 'سەرهێڵ · هاوکاتکردنی ڕاستەوخۆ چالاکە',
      offlineQueuedBadge: 'بێ ئینتەرنێت · {count} خاڵگرتن لە ڕیزدایە ({pts} خاڵ)',
      syncingBadge: 'خاڵە پاشەکەوتکراوەکان هاوکات دەکرێن...',
      syncReadyBadge: '{count} چالاکی پاشەکەوتکراو ئامادەیە بۆ هاوکاتکردن ({pts} خاڵ)',
      syncedSuccessMsg: '{count} چالاکی هاوکات کرا و +{pts} خاڵ زیاد کرا.',
      syncNowBtn: 'هاوکاتکردن ئێستا',
      pendingPointsNotice: '+{pts} خاڵ بە بێ ئینتەرنێت پاشەکەوت کراوە — کاتێک ئینتەرنێت هەبێت خۆکار دەنێردرێت.',
      searchPlaceholder: 'گەڕان بۆ قوتابی بە ناو یان پۆل...',
      allStudentsTitle: 'ڕیزبەندی تەواوی قوتابیان',
      noStudentsYet: 'هێشتا هیچ خاڵێک تۆمار نەکراوە. تاقیکردنەوەیەک بکە بۆ بەدەستهێنانی یەکەم خاڵ!',
      youBadge: 'تۆ',
      ptsUnit: 'خاڵ',
      pointsRulesTitle: 'چۆنیەتی بەدەستهێنانی خاڵ',
      ruleCorrectAnswer: '+{pts} خاڵ بۆ هەر وەڵامێکی ڕاستی تاقیکردنەوە',
      ruleQuizCompleted: '+{pts} خاڵ بۆ تەواوکردنی تاقیکردنەوەیەک',
      ruleHighScore: '+{pts} خاڵی زیادە بۆ نمرەی ٨٠٪ یان زیاتر',
      rulePerfectScore: '+{pts} خاڵی زیادە بۆ نمرەی ١٠٠٪',
      ruleCurriculumActivity: '+{pts} خاڵ بۆ بەکارهێنانی AI، پرسیار لە مامۆستا یان کۆمەڵگا',
      offlineNote: 'خاڵە بەدەستهاتووەکان بێ ئینتەرنێت لەسەر ئامێرەکەت دەپارێزرێن و بە گەڕانەوەی هێڵ خۆکار دەنێردرێن.',
      recentHistoryTitle: 'دوایین چالاکی خاڵەکانت',
      noHistoryYet: 'وەڵامی پرسیارەکان بدەرەوە یان بەشداری چالاکییەکانی خوێندن بکە بۆ کۆکردنەوەی خاڵ.',
      cachedOfflineNotice: 'ڕیزبەندی پاشەکەوتکراو پیشان دەدرێت لە دۆخی بێ ئینتەرنێتدا. خاڵە چاوەڕوانکراوەکانی ئەم ئامێرەش هەژمار کراون.',
      teacherViewNotice: 'هەژمارەکانی مامۆستا و بەڕێوەبەر چاودێری پێشبڕکێکە دەکەن و لەگەڵ قوتابیاندا ڕیزبەندی ناکرێن.',
      rankCol: 'پلە',
      studentCol: 'قوتابی',
      quizzesCol: 'تاقیکردنەوە',
      accuracyCol: 'وردبینی',
      pointsCol: 'خاڵ',
      eventCorrectAnswer: 'وەڵامی ڕاستی پرسیار',
      eventQuizCompleted: 'تەواوکردنی تاقیکردنەوە',
      eventCurriculumActivity: 'چالاکی پڕۆگرام',
    },
    textbooks: {
      title: 'پەرتووک و پرسیار و وەڵامی خوێندن',
      subtitle: 'ڕێبەری بەشەکانی پەرتووکی زانستی پۆلی ٩، هاوکێشە نێودەوڵەتییەکان، سەرچاوە دابەزێنراوەکان و پرسیار و وەڵام بە ڕوونکردنەوەی تەواو.',
      allOverviewTab: 'گشتی هەموو بەشەکان',
      chapterTabPrefix: 'بەشی',
      generalTabLabel: 'بانکی گشتی',
      searchPlaceholder: 'گەڕان لە ناو بابەت، هاوکێشە، پرسیار یان ڕوونکردنەوەکان...',
      filterAll: 'هەموو پرسیار و وەڵامەکان',
      filterWorked: 'نموونە شیکارکراوەکانی پەرتووک',
      filterCurriculum: 'بانکی پرسیارەکانی پڕۆگرام',
      revealAllBtn: 'پیشاندانی هەموو وەڵامەکان',
      hideAllBtn: 'شاردنەوەی وەڵامەکان',
      practiceChapterBtn: 'تاقیکردنەوەی ئەم بەشە',
      addTextbookBtn: 'زیادکردنی پەرتووک / PDF',
      addQaBtn: 'زیادکردنی پرسیار و وەڵام',
      shelfTitle: 'پەرتووکی زانستی پۆلی ٩ و ڕێبەری بەشەکان',
      shelfSub: 'پوختەی بەشەکان، هاوکێشەکانی SI و فایلە بارکراوەکانی مامۆستا.',
      chapterGuideTitle: 'ڕێبەری پەرتووکی بەش و فایلەکان',
      keyFormulasLabel: 'هاوکێشە سەرەکییەکان (SI)',
      attachedFileLabel: 'فایلی پەرتووک',
      openLinkLabel: 'کردنەوەی بەستەری سەرچاوە',
      downloadBtn: 'دابەزاندن',
      teacherMaterialsTitle: 'مەلزەمە و فایلە بڵاوکراوەکانی مامۆستا',
      noResourcesForChapter: 'هێشتا هیچ پەرتووکێک یان فایلی PDF بۆ ئەم بەشە زیاد نەکراوە.',
      qaSectionTitle: 'پرسیار و وەڵام و ڕوونکردنەوەی ڕێکخراو',
      qaSectionSub: 'کرتە لە هەر پرسیارێک بکە بۆ بینینی وەڵامی دروست و ڕوونکردنەوەی هەنگاو بە هەنگاو.',
      qaCountLabel: 'پرسیار و وەڵام',
      showAnswerBtn: 'بینینی وەڵام و ڕوونکردنەوە',
      hideAnswerBtn: 'شاردنەوەی وەڵام',
      correctAnswerHeading: 'وەڵامی پشتڕاستکراوە',
      explanationHeading: 'ڕوونکردنەوەی ورد',
      workedBadge: 'شیکاری پەرتووک',
      curriculumBadge: 'پرسیاری پڕۆگرام',
      generalScopeLabel: 'زانستی گشتی',
      noQaFound: 'هیچ پرسیار و وەڵامێک نەدۆزرایەوە',
      noQaSub: 'بەشێکی تر هەڵبژێرە یان وشەی گەڕانەکە بسڕەوە.',
      loadingTextbooks: 'بارکردنی پەرتووک و پرسیار و وەڵامەکانی پۆلی ٩...',
      offlineCacheNotice: 'دۆخی خوێندنی ئۆفلاین — بینینی پەرتووک و پرسیارە پاشەکەوتکراوەکان.',
      resourceTypes: {
        textbook: 'پەرتووک',
        guide: 'ڕێبەری بەش',
        summary: 'پوختە',
        slides: 'سلاید',
      },
      formResourceTitle: 'زیادکردنی پەرتووکی PDF یان ڕێبەری بەش',
      formTitleLabel: 'ناونیشان',
      formChapterLabel: 'بەش (١–١١ یان گشتی)',
      formAllOverviewOpt: 'گشتی / تەواوی پەرتووک',
      formTypeLabel: 'جۆری سەرچاوە',
      formSummaryLabel: 'پوختەی بەش و چەمکە سەرەکییەکان',
      formFormulasLabel: 'هاوکێشەکان (یەکەکان بە لاتینی بنووسە: N, kg, m, s, J, W)',
      formExternalUrlLabel: 'بەستەری دەرەکی (ئارەزوومەندانە)',
      formAttachFileLabel: 'هاوپێچکردنی فایلی PDF، وێنە یان دۆکیومێنت',
      formSaveResourceBtn: 'بڵاوکردنەوەی سەرچاوەی پەرتووک',
      formQaTitle: 'زیادکردنی پرسیار و وەڵامی خوێندن',
      formEditQaTitle: 'دەستکاریکردنی پرسیار و وەڵام',
      formQuestionLabel: 'دەقی پرسیار',
      formAnswerLabel: 'وەڵامی ڕاست',
      formExplanationLabel: 'ڕوونکردنەوەی هەنگاو بە هەنگاو',
      formSourceLabel: 'سەرچاوە (بۆ نموونە بەشی ١ · نموونەی پەرتووک)',
      formSaveQaBtn: 'پاشەکەوتکردنی پرسیار و وەڵام',
      formUpdateQaBtn: 'نوێکردنەوەی پرسیار و وەڵام',
      formCancelBtn: 'پاشگەزبوونەوە',
      savingMsg: 'پاشەکەوت دەکرێت...',
      resourceAddedMsg: 'سەرچاوەی پەرتووک بڵاوکرایەوە و لە پاشەکەوتی هەمیشەییدا تۆمارکرا.',
      qaSavedMsg: 'پرسیار و وەڵام بە سەرکەوتوویی پاشەکەوت کرا.',
      deleteConfirmBtn: 'سڕینەوە',
      officialBookTitle: 'پەرتووکی فەرمی زانستی پۆلی ٩',
      officialBookMeta: '٣٠٦ لاپەڕە · بەشەکانی ١–١١ · PDF',
      officialBookDesc: 'لاپەڕەکانی پەرتووکەکە ڕاستەوخۆ لە ناو ئەپەکەدا ببینە، بازبدە بۆ هەر بەشێک، یان دایبەزێنە بۆ خوێندنی بێ ئینتەرنێت.',
      previewBookBtn: 'بینینی پەرتووک',
      previewChapterPageBtn: 'خوێندنەوە لە پەرتووک',
      previewPdfBtn: 'بینین لە ناو ئەپ',
      pageLabel: 'لاپەڕە',
      ofPagesLabel: 'لە',
      prevPageBtn: 'پێشوو',
      nextPageBtn: 'دواتر',
      coverLabel: 'بەرگ',
      contentsLabel: 'پێڕست',
      fitWidthBtn: 'پڕ بە شاشە',
      openNewTabBtn: 'کردنەوەی فایل',
      loadingPageMsg: 'بارکردنی لاپەڕەی پەرتووک...',
      pdfLoadErrorMsg: 'نەتوانرا فایلەکە لێرە پیشان بدرێت. دەتوانیت لە خوارەوە بیکەیتەوە یان دایبەزێنیت.',
      closeReaderBtn: 'داخستنی خوێنەر',
      contentsJumpBtn: 'پێڕست (ل.٢)',
      fullBookBtn: 'تەواوی پەرتووک (ل.١)',
      allChaptersTextbookGridTitle: 'بەشەکانی پەرتووکی فەرمی (١–١١)',
      allChaptersTextbookGridSub: 'ڕاستەوخۆ بچۆ ناو هەر بەشێکی پەرتووکی Science_9_Book.pdf (٣٠٦ لاپەڕە).',
      readChapterPdfBtn: 'کردنەوەی بەش',
      textbookShortLabel: 'پەرتووک',
      readFullTextbookBtn: 'خوێندنەوەی پەرتووک (٣٠٦ ل.)',
      previewTextbookBtn: 'بینینی پەرتووکی PDF',
    },
  },

  ar: {
    brand: {
      appName: 'منصة الصف التاسع',
      scienceStudio: 'استوديو الذكاء العلمي',
      schoolTag: 'منصة الصف التاسع · علوم الصف التاسع',
      motivationalQuote: 'جهدك اليوم هو مجدك غداً.',
      motivationalQuotes: [
        'جهدك اليوم هو مجدك غداً.',
        'الفضول العلمي هو الشرارة التي تحوّل الأسئلة إلى اكتشاف.',
        'كل مسألة علمية تحلها اليوم تصنع عقلاً أكثر تميزاً.',
        'الخطوات الدراسية الصغيرة كل يوم تصنع نتائج عظيمة.',
        'العلم يكافئ الصبر والمثابرة والعقل المتسائل.',
        'أخطاء التدريب هي درجات تقودك إلى الإتقان.',
      ],
      poweredBy: 'إدارة وتطوير الأستاذ كسروان',
      splashSubtitle: 'منصة تفاعلية لتعلّم العلوم للصف التاسع',
      offlineMode: 'وضع عدم الاتصال — عرض المحتوى المحفوظ',
      installApp: 'تثبيت التطبيق',
      installIOS: 'التثبيت على iOS',
      installIOSTitle: 'تثبيت منصة الصف التاسع على آيفون',
      installIOSSub: 'الإضافة إلى الشاشة الرئيسية',
      installIOSStep1: '١. اضغط على زر المشاركة (Share) في متصفح سفاري.',
      installIOSStep2: '٢. مرّر للأسفل واختر إضافة إلى الشاشة الرئيسية (Add to Home Screen).',
      installIOSStep3: '٣. اضغط على إضافة (Add) لفتح التطبيق مباشرة.',
      gotIt: 'فهمت',
      greetingMorning: 'صباح الخير',
      greetingAfternoon: 'طاب مساؤك',
      greetingEvening: 'مساء الخير',
      studentGreetingTemplate: '{timeGreeting}، طالبي العزيز! مرحباً بك',
      heroJourneySubtitle: 'نتمنى لك رحلة تعليمية موفقة ومليئة بالاكتشاف والنجاح.',
    },
    nav: {
      home: 'الرئيسية',
      community: 'مجتمع الطلاب',
      competition: 'المسابقة ولوحة المتصدرين',
      adminDashboard: 'لوحة تحكم المسؤول',
      multipleChoice: 'الاختيار من متعدد',
      textbooksQa: 'الكتب المدرسية والأسئلة والأجوبة',
      generalQuestions: 'أسئلة عامة',
      askTeacher: 'اسأل معلمك',
      notifications: 'الإشعارات',
      scienceStudio: 'استوديو الذكاء العلمي',
      profile: 'الملف الشخصي',
      settings: 'الإعدادات',
      about: 'حول المنصة',
      quizzesShort: 'الاختبارات',
      teacherShort: 'المعلم',
      studioShort: 'الاستوديو',
      logOut: 'تسجيل الخروج',
      openStudioBtn: 'فتح استوديو الذكاء العلمي',
      expandSidebar: 'توسيع القائمة',
      collapseSidebar: 'طي القائمة',
      chooseLanguage: 'تغيير اللغة',
      switchToDark: 'التبديل إلى الوضع الداكن',
      switchToLight: 'التبديل إلى الوضع الفاتح',
    },
    auth: {
      heroBadge: 'علوم الصف التاسع · ١١ فصلاً',
      heroTitle: 'المنصة الرسمية لتعلّم العلوم لطلاب الصف التاسع.',
      heroDesc:
        'أتقن الفصول الـ ١١ باختبارات وتصحيح فوري، وتواصل مباشر مع الأستاذ كسروان، واستوديو الذكاء العلمي.',
      statChaptersLabel: 'فصول الصف التاسع',
      statDirectTitle: 'مباشر',
      statDirectLabel: 'اسأل معلمك',
      statPwaLabel: 'تطبيق قابل للتثبيت',
      loginTab: 'تسجيل الدخول',
      registerTab: 'إنشاء حساب',
      welcomeBack: 'أهلاً بعودتك',
      loginSubtitle: 'سجّل الدخول ببريدك الإلكتروني كطالب في الصف التاسع أو معلم.',
      emailLabel: 'البريد الإلكتروني',
      passwordLabel: 'كلمة المرور',
      forgotPassword: 'هل نسيت كلمة المرور؟',
      loginBtn: 'تسجيل الدخول إلى منصة الصف التاسع',
      signingIn: 'جاري تسجيل الدخول...',
      createTitle: 'أنشئ حسابك الجديد',
      createSubtitle: 'سجّل كطالب في الصف التاسع للوصول إلى جميع الفصول والتواصل مع المعلم.',
      fullNameLabel: 'الاسم الكامل',
      emailRegisterLabel: 'البريد الإلكتروني / Gmail',
      birthdayLabel: 'تاريخ الميلاد',
      gradeLabel: 'الصف / الشعبة (اختياري)',
      gradePlaceholder: 'مثال: الصف التاسع أ - علوم',
      passwordCreateLabel: 'كلمة المرور (٦ أحرف على الأقل)',
      confirmPasswordRegisterLabel: 'تأكيد كلمة المرور',
      confirmPasswordPlaceholder: 'أعد إدخال كلمة المرور',
      registerBtn: 'إنشاء حساب طالب',
      creatingAccount: 'جاري إنشاء الحساب...',
      backToLogin: 'العودة إلى تسجيل الدخول',
      resetTitle: 'استعادة كلمة المرور',
      resetSubtitle: 'استلم رمز تحقق مكوّن من ٦ أرقام على بريد Gmail المسجّل.',
      registeredGmailLabel: 'بريد Gmail المسجّل',
      sendCodeBtn: 'إرسال رمز التحقق',
      sendingCode: 'جاري إرسال الرمز...',
      codeLabel: 'رمز التحقق (٦ أرقام)',
      verifyCodeBtn: 'تحقق من الرمز',
      verifyingCode: 'جاري التحقق...',
      newPasswordLabel: 'كلمة المرور الجديدة',
      confirmPasswordLabel: 'تأكيد كلمة المرور الجديدة',
      savePasswordBtn: 'حفظ كلمة المرور الجديدة',
      savingPassword: 'جاري الحفظ...',
      returnLoginBtn: 'العودة إلى تسجيل الدخول',
      passwordsMismatch: 'كلمتا المرور غير متطابقتين.',
      verifiedMsg: 'تم تأكيد رمز التحقق. أدخل كلمة المرور الجديدة أدناه.',
      rememberMe: 'تذكرني',
      savedSessionNote: 'تبقى جلستك محفوظة بأمان حتى تقوم بتسجيل الخروج يدوياً.',
      dbEmptyTitle: 'تم اكتشاف إعادة تشغيل الخادم بدون حسابات (0 حسابات)',
      dbEmptyDesc:
        'لا توجد حسابات مسجّلة في هذه النسخة من الخادم حالياً. إذا كان لديك ملف نسخ احتياطي (.json)، أدخل بريد المسؤول وكلمة المرور أعلاه واستعد جميع الحسابات والبيانات أدناه، أو انتقل إلى إنشاء حساب.',
      vaultDetectedDesc:
        'يوجد نسخ احتياطي مشفّر محفوظ في هذا المتصفح ({count} حسابات). سجّل الدخول ببريد المسؤول وكلمة المرور لاستعادة جميع الحسابات تلقائياً.',
      restoreFromFileBtn: 'استعادة الحسابات من ملف النسخ الاحتياطي (.json)',
      restoringFromVault: 'جاري استعادة الحسابات والبيانات...',
      enterAdminCredentialsForRestore:
        'أدخل بريد المسؤول وكلمة المرور في النموذج أعلاه أولاً، ثم اختر ملف النسخ الاحتياطي .json.',
      continueWithGoogle: 'المتابعة باستخدام Google',
      cloudSyncBadge: 'محفوظ في السحابة — يبقى آمناً مع كل تحديث أو تغيير للرابط',
      orEmailSeparator: 'أو',
      googleSignInLoading: 'جاري الاتصال بحساب Google...',
      googleSignInFailed: 'تعذر إكمال تسجيل الدخول عبر Google. يرجى السماح بالنوافذ المنبثقة والمحاولة مجدداً.',
      adminClaimPrompt:
        'تمت إعادة تعيين قاعدة البيانات بعد التحديث. سجّل الدخول عبر Google أدناه أو انتقل إلى إنشاء حساب لتعيين كلمة المرور.',
    },
    home: {
      welcome: 'مرحباً',
      mainAdmin: 'المسؤول الرئيسي',
      teacherWorkspace: 'لوحة المعلم',
      studentPortal: 'بوابة طالب الصف التاسع',
      heroTitle: 'منهج العلوم للصف التاسع',
      heroDesc:
        'تدرّب على جميع فصول علوم الصف التاسع الأحد عشر سؤالاً بسؤال مع الشرح الفوري، وتواصل مع الأستاذ كسروان بالصور والملفات، واستكشف استوديو الذكاء العلمي.',
      openChaptersBtn: 'فتح الفصول الـ ١١',
      askTeacherBtn: 'اسأل معلمك',
      cardModulesLabel: 'وحدات الكتاب',
      chaptersCount: '١١ فصلاً',
      chapterQuestions: 'سؤالاً في الفصول',
      cardGeneralLabel: 'البنك العام',
      generalDesc: 'أسئلة علوم عامة',
      cardAlertsLabel: 'تنبيهات غير مقروءة',
      alertsDesc: 'الإعلانات والردود',
      cardStudioLabel: 'دعم الدراسة',
      studioDesc: 'معلم ذكي ومخططات 4K',
      announcementsTitle: 'الإعلانات والمواد الدراسية',
      announcementsDesc: 'التحديثات والإعلانات والملفات المنشورة من قِبل الأستاذ كسروان.',
      publishBtn: 'نشر إعلان / ملف',
      closeFormBtn: 'إغلاق النموذج',
      titleLabel: 'العنوان',
      categoryLabel: 'التصنيف',
      announcementOpt: 'إعلان',
      materialOpt: 'مادة دراسية / ملف',
      messageLabel: 'نص الرسالة',
      attachOptional: 'إرفاق ملف أو صورة (اختياري)',
      publishNotifyBtn: 'نشر وإشعار الطلاب',
      publishingNotify: 'جاري النشر...',
      noAnnouncements: 'لا توجد إعلانات أو مواد منشورة بعد. ستظهر تحديثات الأستاذ كسروان هنا.',
      download: 'تنزيل',
      quickJumpTitle: 'انتقال سريع إلى الفصول',
      quickJumpDesc: 'اختر اختبار جميع الفصول أو انتقل مباشرة إلى أي فصل من ١ إلى ١١.',
      startAllChapters: 'بدء اختبار جميع الفصول ←',
      chapterWord: 'الفصل',
      questionSingular: 'سؤال',
      questionPlural: 'أسئلة',
      topScorersTitle: 'المتفوقون · مسابقة الطلاب',
      topScorersSub: 'اكسب النقاط عبر حل الأسئلة وإكمال الاختبارات والمشاركة في علوم الصف التاسع.',
      viewLeaderboardBtn: 'عرض لوحة المتصدرين',
      yourRankLabel: 'ترتيبك',
      ptsUnit: 'نقطة',
      pendingSyncShort: 'قيد الانتظار',
      noScorersYet: 'أكمل اختباراً أو أجب عن الأسئلة لتظهر في قائمة المتفوقين.',
      textbooksCardTitle: 'الكتب المدرسية والأسئلة والأجوبة',
      textbooksCardSub: 'تصفح أدلة فصول كتاب علوم الصف التاسع، القوانين العلمية بالرموز الدولية، الملفات، والأسئلة المحلولة مع الشرح.',
      openTextbooksBtn: 'فتح الكتب والأسئلة والأجوبة',
      textbooksGuidesLabel: 'أدلة الفصول والقوانين',
      textbooksQaLabel: 'بنك الأسئلة المحلولة',
      heroSliderLabel: 'معرض صور العلوم',
      prevSlideBtn: 'الشريحة السابقة',
      nextSlideBtn: 'الشريحة التالية',
      goToSlideBtn: 'الانتقال إلى الشريحة {n}',
    },
    quiz: {
      mcTitle: 'الاختيار من متعدد · ١١ فصلاً',
      mcSubtitle: 'اختر جميع الفصول لاختبار شامل أو اختر فصلاً محدداً من الفصول ١–١١.',
      addQuestion: 'إضافة سؤال',
      bulkImport: 'استيراد جماعي',
      allChapters: 'جميع الفصول',
      combinedBadge: 'اختبار شامل · الفصول ١–١١',
      allChaptersDesc: 'أجب عن أسئلة من جميع الفصول الأحد عشر سؤالاً بسؤال مع الشرح الفوري واعرض نتيجتك النهائية.',
      totalQuestions: 'إجمالي الأسئلة',
      openChapter: 'فتح الفصل',
      all11ChaptersBack: 'جميع الفصول الـ ١١',
      allChaptersQuizTitle: 'اختبار جميع الفصول الشامل',
      questionsAvailable: 'سؤال متاح',
      manageAllQuestions: 'إدارة جميع الأسئلة',
      backToQuizMode: 'العودة إلى وضع الاختبار',
      addQuestionHere: 'إضافة سؤال هنا',
      loadingQuestions: 'جاري تحميل الأسئلة...',
      noQuestionsYet: 'لم تُضف أسئلة بعد',
      noQuestionsAllDesc: 'الأسئلة المضافة إلى الفصول ١–١١ ستظهر هنا تلقائياً.',
      noQuestionsChDesc: 'هذا الفصل جاهز وبانتظار الأسئلة من الأستاذ كسروان.',
      questionOf: 'السؤال {current} من {total}',
      scoreSoFar: 'النتيجة حتى الآن',
      checkingAnswer: 'جاري التحقق من إجابتك...',
      correctTitle: 'إجابة صحيحة! الخيار {opt} صحيح.',
      wrongTitle: 'إجابة خاطئة — اخترت الخيار {opt} ({text}).',
      whyWrong: 'لماذا هذه الإجابة خاطئة:',
      correctAnswerLabel: 'الإجابة الصحيحة: الخيار {opt} — {text}',
      whyTrue: 'لماذا هي صحيحة: ',
      whyOptionTrue: 'لماذا الخيار {opt} صحيح: ',
      readyNext: 'أنت جاهز للانتقال إلى السؤال التالي.',
      completedLast: 'لقد أنهيت السؤال الأخير في هذا الاختبار.',
      nextQuestion: 'السؤال التالي',
      finishViewScore: 'إنهاء وعرض النتيجة النهائية',
      calculatingScore: 'جاري حساب النتيجة...',
      selectPrompt: 'اختر إجابة أعلاه لعرض الشرح وتفعيل زر السؤال التالي.',
      quizComplete: 'اكتمل الاختبار · النتيجة النهائية',
      reviewBelow: 'راجع كل سؤال مع الشرح أدناه.',
      retakeQuiz: 'إعادة الاختبار',
      correctBadge: 'إجابة صحيحة',
      incorrectBadge: 'إجابة خاطئة',
      explanationLabel: 'الشرح:',
      generalTitle: 'الأسئلة العامة',
      generalSubtitle: 'أسئلة شاملة في علوم الصف التاسع بإشراف الأستاذ كسروان.',
      addGeneralBtn: 'إضافة سؤال عام',
      noGeneralYet: 'لا توجد أسئلة عامة بعد',
      noGeneralDesc: 'ستظهر الأسئلة العامة في علوم الصف التاسع المنشورة من الأستاذ كسروان هنا.',
      tryAgain: 'حاول مجدداً',
      save: 'حفظ',
      cancel: 'إلغاء',
      saveQuestion: 'حفظ السؤال',
      updateQuestion: 'تحديث السؤال',
      importQuestions: 'استيراد الأسئلة',
      editQuestion: 'تعديل السؤال',
      addChapterQuestion: 'إضافة سؤال إلى الفصل',
      targetChapter: 'الفصل المستهدف',
      correctAnswerOpt: 'الإجابة الصحيحة',
      questionTextLabel: 'نص السؤال (بالصياغة الأصلية)',
      explanationFieldLabel: 'الشرح (يظهر فوراً بعد اختيار الطالب للإجابة)',
      bulkTitle: 'إضافة أسئلة متعددة',
      bulkDesc: 'ألصق الأسئلة مفصولة بسطر فارغ باستخدام A), B), C), D) و Answer: X.',
      destChapter: 'الفصل الوجهة',
      questionSavedMsg: 'تم تحديث السؤال بنجاح.',
      questionAddedMsg: 'تمت إضافة السؤال إلى الفصل {chapter} وإشعار الطلاب.',
      bulkImportedMsg: 'تم استيراد {count} سؤالاً إلى الفصل {chapter}.',
      defaultWrongReason: 'الخيار {opt} لا يتوافق مع المبدأ العلمي الصحيح.',
      pointsEarnedPill: '+{pts} نقاط مكتسبة',
      offlineQueuedAnswerNotice: 'تم الحفظ دون إنترنت — ستُزامَن إجابتك ونقاطك وتُصحَّح تلقائياً عند عودة الاتصال.',
      offlineQuizSavedTitle: 'تم حفظ الاختبار دون إنترنت · بانتظار المزامنة',
      offlineQuizSavedDesc: 'أنت غير متصل حالياً. تم حفظ جميع إجاباتك محلياً وستُحتسب نقاطك تلقائياً بمجرد عودة الاتصال.',
      cachedOfflineModeNotice: 'وضع الدراسة دون إنترنت — يتم عرض الأسئلة المحفوظة محلياً. ستتم مزامنة النقاط عند الاتصال.',
    },
    askTeacher: {
      title: 'اسأل معلمك',
      teacherSub: 'استعرض أسئلة الطلاب والصور والملفات المرفقة وأجب مباشرة.',
      studentSub: 'أرسل أسئلتك أو صوّر التمارين وأرفق المستندات مباشرة إلى الأستاذ كسروان.',
      studentConversations: 'محادثات الطلاب',
      loadingThreads: 'جاري تحميل المحادثات...',
      noMessagesTeacher: 'لا توجد رسائل من الطلاب بعد.',
      newBadge: 'جديد',
      backToStudents: 'الطلاب',
      selectStudent: 'اختر طالباً',
      chooseLeft: 'اختر محادثة طالب من القائمة',
      teacherRoleSub: 'معلم علوم الصف التاسع · مراسلة مباشرة',
      selectPrompt: 'اختر طالباً من القائمة لعرض الرسائل والمرفقات.',
      noMessagesChat: 'لا توجد رسائل في هذه المحادثة بعد. اكتب سؤالاً أو أرفق ملفاً أدناه.',
      replyPlaceholder: 'اكتب ردك على هذا الطالب...',
      askPlaceholder: 'اسأل الأستاذ كسروان سؤالاً...',
      sending: 'جاري الإرسال...',
      send: 'إرسال',
      download: 'تنزيل',
      onlineLabel: 'متصل',
      offlineLabel: 'غير متصل',
    },
    notifications: {
      title: 'الإشعارات',
      unreadLabel: 'إشعارات غير مقروءة',
      pushActive: 'تنبيهات الخلفية مفعّلة (إيقاف)',
      enablePush: 'تفعيل تنبيهات الخلفية (Push)',
      enablingPush: 'جاري التفعيل...',
      markAllRead: 'تحديد الكل كمقروء',
      allCaughtUp: 'اطّلعت على جميع الإشعارات',
      emptyDesc: 'ستظهر هنا الإعلانات والأسئلة الجديدة والملفات الدراسية وردود المعلم.',
      unreadTag: 'غير مقروء',
      categories: {
        announcement: 'إعلان',
        question: 'سؤال',
        chapter: 'فصل',
        material: 'مادة دراسية',
        reply: 'رد',
      },
    },
    notifPrompt: {
      title: 'هل تسمح لمنصة الصف التاسع بإرسال الإشعارات إليك؟',
      subtitle: 'تلقَّ إشعارات للإعلانات والأسئلة الجديدة وردود الأستاذ كسروان.',
      allow: 'سماح',
      dontAllow: 'عدم السماح',
      bannerTitle: 'ابقَ على اطلاع بتنبيهات منصة الصف التاسع',
      bannerDesc: 'فعّل الإشعارات لاستلام الإعلانات والأسئلة الجديدة والردود فوراً.',
      bannerEnableBtn: 'تفعيل الإشعارات',
      bannerDismissLabel: 'إغلاق شريط الإشعارات',
    },
    aiStudio: {
      title: 'استوديو الذكاء العلمي',
      subtitle: 'معلم ذكي متعدد المحادثات بـ Gemini ومولّد مخططات علمية عالية الدقة (1K, 2K, 4K).',
      tutorChatTab: 'محادثة المعلم الذكي',
      diagramTab: 'مولّد المخططات العلمية',
      modelLabel: 'نموذج Gemini',
      rolePresetLabel: 'دور المعلم الذكي',
      systemInstructionLabel: 'تعليمات النظام',
      clearHistory: 'مسح سجل المحادثة',
      threadTitle: 'سلسلة الدراسة التفاعلية',
      emptyTitle: 'اسأل سؤالاً في علوم الصف التاسع',
      emptyDesc: 'تحفظ المحادثة السياق الكامل عبر الأدوار لمتابعة أسئلتك حول القوانين والحسابات العلمية.',
      thinking: 'جاري التفكير...',
      chatPlaceholder: 'اسأل عن الشغل، القدرة، الطاقة الحركية، انتقال الحرارة...',
      send: 'إرسال',
      retry: 'إعادة المحاولة',
      stop: 'إيقاف',
      diagramTitle: 'مولّد المخططات عالية الدقة',
      diagramSub: 'مدعوم بمحرك المخططات Gemini 4 Hydrogen مع اختيار دقة PNG 1K و 2K و 4K.',
      diagramPromptLabel: 'وصف المخطط أو الصورة العلمية',
      diagramPlaceholder: 'مثال: مخطط علمي تعليمي واضح لانكسار الضوء عبر منشور زجاجي',
      resolutionLabel: 'دقة الصورة',
      aspectRatioLabel: 'نسبة العرض إلى الارتفاع',
      generateBtn: 'إنشاء صورة بدقة {size}',
      generatingBtn: 'جاري إنشاء مخطط {size}...',
      noVisualsTitle: 'لا توجد صور منشأة بعد',
      noVisualsDesc: 'صف مفهوماً علمياً أو آلة بسيطة أو مخطط طاقة واختر دقة 1K أو 2K أو 4K.',
      download: 'تنزيل',
      models: {
        hydrogen: 'Gemini 4 Hydrogen (المهام العامة)',
        flashLite: 'Gemini 3.1 Flash Lite (استجابة سريعة)',
        argon: 'Gemini 4 Argon (العلوم المتقدمة)',
        carbon: 'Gemini 4 Carbon (التحليل العميق والبراهين)',
      },
      roles: {
        physicsTutorLabel: 'معلم مفاهيم العلوم',
        physicsTutorInstruction:
          'أنت معلم علوم للصف التاسع تشرح بإيجاز ووضوح باللغة العربية مع القانون ومثال يومي قصير، مع إبقاء رموز الوحدات الدولية باللاتينية (N, kg, m, s, m/s, J, W, Hz, Pa, °C, K).',
        stepSolverLabel: 'حلّال المسائل خطوة بخطوة',
        stepSolverInstruction:
          'أنت حلّال مسائل علوم للصف التاسع. اكتب المعطيات والقانون وخطوات الحل بإيجاز باللغة العربية مع إبقاء رموز الوحدات الدولية باللاتينية (N, kg, m, s, m/s, J, W, Hz, Pa, °C, K).',
        labCoachLabel: 'مدرّب المختبر والتجارب',
        labCoachInstruction:
          'أنت مدرّب مختبر علوم للصف التاسع. ساعد بإيجاز بالعربية في تصميم تجارب آمنة وتحديد المتغيرات وتحليل القياسات.',
      },
    },
    profile: {
      title: 'الملف الشخصي والتقدّم',
      subtitle: 'أدر صورتك الشخصية وبيانات حسابك وراجع سجل اختباراتك.',
      mainAdminLabel: 'المسؤول الرئيسي والمعلم',
      teacherAccount: 'حساب معلم',
      studentAccount: 'حساب طالب',
      adminBadge: 'المسؤول',
      fullName: 'الاسم الكامل',
      birthdayLabel: 'تاريخ الميلاد',
      gradeFocus: 'الصف / التخصص',
      bio: 'نبذة شخصية',
      avatarTitle: 'الصورة الشخصية',
      avatarDesc: 'ارفع صورة شخصية لتظهر في ملفك الشخصي ومحادثات المعلم.',
      uploadAvatar: 'رفع صورة',
      changeAvatar: 'تغيير الصورة',
      removeAvatar: 'إزالة الصورة',
      uploadingAvatar: 'جاري الرفع...',
      avatarUpdatedMsg: 'تم تحديث الصورة الشخصية.',
      avatarRemovedMsg: 'تمت إزالة الصورة الشخصية.',
      changePasswordOpt: 'تغيير كلمة المرور (اختياري)',
      currentPassPlaceholder: 'كلمة المرور الحالية',
      newPassPlaceholder: 'كلمة مرور جديدة (٦+ أحرف)',
      saveChanges: 'حفظ التغييرات',
      saving: 'جاري الحفظ...',
      pushTitle: 'الإشعارات الفورية (Push)',
      pushDesc: 'استلم تنبيهات فورية للإعلانات والأسئلة الجديدة وردود المعلم حتى عند إغلاق التطبيق.',
      disablePush: 'إيقاف الإشعارات',
      enablePush: 'تفعيل الإشعارات',
      recentAttempts: 'آخر محاولات الاختبار',
      noAttempts: 'لا توجد محاولات مسجّلة بعد. أكمل اختبار فصل لتتبع درجاتك.',
      allChaptersCombined: 'جميع الفصول الشامل',
      generalQuestionsLabel: 'الأسئلة العامة',
      adminControlsTitle: 'لوحة تحكم المسؤول · الحسابات المسجّلة',
      adminControlsDesc: 'يمكن للمسؤول الرئيسي تعديل الفصول ونشر الإعلانات والأسئلة وإدارة الرسائل وتعديل صلاحيات الحسابات.',
      accountsCount: 'حسابات',
      loadingAccounts: 'جاري تحميل الحسابات...',
      noAccounts: 'لا توجد حسابات مسجّلة بعد.',
      mainAdminTag: 'المسؤول الرئيسي',
      adminTeacherTag: 'مسؤول / معلم',
      studentTag: 'طالب',
      setStudent: 'تعيين كطالب',
      makeAdmin: 'تعيين كمسؤول',
      confirm: 'تأكيد',
      cancel: 'إلغاء',
      updatedMsg: 'تم تحديث الملف الشخصي بنجاح.',
      roleUpdatedMsg: 'تم تغيير صلاحية {name} إلى {role}.',
      accountRemovedMsg: 'تم حذف الحساب.',
      cropModalTitle: 'قصّ وتعديل حجم الصورة الشخصية',
      cropModalSub: 'اسحب للتحريك أو كبّر أو دوّر الصورة قبل حفظها بدقة 256×256.',
      zoomLabel: 'التكبير',
      rotateBtn: 'تدوير ٩٠°',
      resetCropBtn: 'إعادة ضبط',
      applyCropUploadBtn: 'قصّ ورفع الصورة',
      invalidImageType: 'يرجى اختيار صورة بصيغة PNG أو JPG أو WebP أو GIF.',
      imageTooLarge: 'يجب أن يكون حجم الصورة أقل من 15 MB.',
      dangerZoneTitle: 'منطقة الخطر · حذف الحساب',
      dangerZoneDesc: 'احذف حسابك وسجل اختباراتك ومنشوراتك ورسائلك ونقاط المسابقة نهائياً. لا يمكن التراجع عن هذا الإجراء.',
      deleteAccountBtn: 'حذف حسابي نهائياً',
      deleteAccountModalTitle: 'هل تريد حذف حسابك نهائياً؟',
      deleteAccountWarning: 'سيتم حذف جميع محاولات الاختبار ونقاط المسابقة ومحادثات المعلم ورسائل المجتمع نهائياً وسيتم تسجيل خروجك فوراً.',
      deleteAccountTypeLabel: 'اكتب DELETE للتأكيد على الحذف النهائي',
      deleteAccountPlaceholder: 'اكتب DELETE',
      confirmDeleteAccountBtn: 'تأكيد حذف الحساب نهائياً',
      deletingAccount: 'جاري حذف الحساب...',
      protectedAdminDeleteNote: 'لا يمكن حذف حساب المسؤول الرئيسي حفاظاً على استقرار النظام.',
      refreshAccountsBtn: 'تحديث',
      searchAccountsPlaceholder: 'ابحث عن الحسابات بالاسم أو البريد أو الصف...',
      filterAllAccounts: 'الكل',
      filterStudentsOnly: 'الطلاب',
      filterAdminsOnly: 'المسؤولون / المعلمون',
      filterOnlineOnly: 'متصل',
      filterRestrictedOnly: 'مقيّد',
      inspectEditBtn: 'فحص / تعديل',
      inspectModalTitle: 'فحص وتعديل الحساب',
      accountUpdatedMsg: 'تم تحديث ملف حساب {name}.',
      roleLabel: 'دور الحساب',
      sourceLabel: 'مصدر السجل',
      joinedLabel: 'تاريخ الانضمام',
      loadAccountsError: 'تعذر تحميل الحسابات المسجّلة.',
    },
    settings: {
      title: 'إعدادات النظام والدراسة',
      subtitle: 'خصّص وضع الإضاءة، حجم الخط، اللغة، وتجربة الاختبارات لمادة علوم الصف التاسع.',
      appearanceTitle: 'وضع المظهر (Theme)',
      appearanceDesc: 'اختر الوضع الأبيض (الفاتح)، أو الداكن، أو التلقائي حسب إعدادات جهازك.',
      themeLabel: 'نمط الألوان',
      themeLight: 'أبيض (فاتح)',
      themeLightDesc: 'خلفية ورقية فاتحة واضحة للدراسة النهارية.',
      themeDark: 'داكن (ليلي)',
      themeDarkDesc: 'مظهر داكن مريح للعين للدراسة في الإضاءة المنخفضة.',
      themeAuto: 'تلقائي (Auto)',
      themeAutoDesc: 'يتبع مظهر الهاتف أو الحاسوب تلقائياً.',
      activeModeResolved: 'الوضع المفعّل حالياً',
      fontSizeLabel: 'حجم الخط',
      fontSizeDesc: 'تحكم بحجم النصوص والأسئلة والخيارات في جميع شاشات التطبيق.',
      fontSmall: 'صغير',
      fontNormal: 'عادي',
      fontLarge: 'كبير',
      fontXLarge: 'كبير جداً',
      fontPreviewLabel: 'معاينة مباشرة للنص',
      fontPreviewSample: 'علوم الصف التاسع: الطاقة لا تفنى ولا تستحدث بل تتحول من شكل إلى آخر.',
      languageTitle: 'لغة التطبيق والمنهج',
      languageDesc: 'بدّل جميع القوائم والـ ١١ فصلاً والأسئلة والشروحات بين العربية والكوردية والإنجليزية.',
      preferencesTitle: 'تفضيلات الدراسة وإمكانية الوصول',
      preferencesDesc: 'اضبط المؤثرات الصوتية والتمرير التلقائي للشرح وسرعة الحركة.',
      soundFeedbackLabel: 'أصوات تنبيه الإجابة',
      soundFeedbackDesc: 'تشغيل نغمة لطيفة عند التحقق من صحة أو خطأ الإجابة.',
      autoScrollLabel: 'التمرير التلقائي للشرح',
      autoScrollDesc: 'تحريك الشاشة بسلاسة نحو الشرح وزر السؤال التالي بعد اختيار الإجابة.',
      reduceMotionLabel: 'تقليل الحركة والانتقالات',
      reduceMotionDesc: 'تخفيف الحركات والانتقالات لقراءة أهدأ وأسرع.',
      notificationsTitle: 'التنبيهات والإشعارات',
      notificationsDesc: 'إدارة إشعارات الخلفية للدروس والأسئلة الجديدة وردود المعلم.',
      notificationsStatusEnabled: 'مفعّلة',
      notificationsStatusDisabled: 'معطّلة',
      notificationsStatusBlocked: 'محظورة من المتصفح أو الجهاز',
      notificationsBlockedHelp: 'الإشعارات محظورة حالياً من المتصفح أو الجهاز. افتح أذونات الموقع (أيقونة القفل في شريط العنوان أو إعدادات التطبيق في الهاتف) وفعّل الإشعارات (Allow)، ثم اضغط على تفعيل مجدداً.',
      openNotificationsBtn: 'فتح إعدادات الإشعارات',
      resetDefaults: 'استعادة الإعدادات الافتراضية',
      resetDone: 'تمت استعادة الإعدادات الافتراضية.',
      accentThemeTitle: 'السمة ولون التمييز',
      accentThemeDesc: 'خصّص اللون الرئيسي المستخدم في القوائم والأزرار والتمييزات عبر التطبيق.',
      accentActiveLabel: 'السمة النشطة',
      accentPreviewBtn: 'زر معاينة',
      accentColors: {
        burgundy: 'عنابي كلاسيكي',
        indigo: 'نيلي (Indigo)',
        emerald: 'زمردي (Emerald)',
        violet: 'بنفسجي (Violet)',
        blue: 'أزرق (Blue)',
        rose: 'وردي (Rose)',
        amber: 'كهرماني (Amber)',
      },
    },
    about: {
      kicker: 'حول المعلم والمطوّر',
      name: 'كسروان محمد',
      roleLine: 'معلم علوم الصف التاسع | مطوّر ويب',
      bioP1:
        'كسروان محمد معلم متخصص في علوم الصف التاسع ومطور ويب متكامل، يكرّس جهده لتطوير أساليب تعلّم الطلاب وفهم القوانين العلمية وحل المسائل.',
      bioP2:
        'من خلال الجمع بين تدريس العلوم الصفي وهندسة الويب الحديثة، يصمّم تطبيقات تعليمية تفاعلية تُبقي الطلاب على تواصل دائم مع الاختبارات المنظمة والتوجيه المباشر من المعلم.',
      pillar1Title: 'تعليم العلوم',
      pillar1Desc: 'وضوح مفاهيمي في الميكانيكا والآلات البسيطة والطاقة والحرارة وعلوم الصف التاسع.',
      pillar2Title: 'تطبيقات الويب التعليمية',
      pillar2Desc: 'تطبيقات متجاوبة وقابلة للتثبيت مصممة للدراسة اليومية في الصف والمنزل.',
      pillar3Title: 'التقنية والعلوم',
      pillar3Desc: 'الجمع بين الاختبارات التفاعلية والشرح الفوري والدعم المباشر للطلاب.',
    },
    admin: {
      title: 'لوحة تحكم المسؤول والمراقبة المباشرة',
      subtitle: 'ابحث بسرعة عن الطلاب والأسئلة والفصول والرسائل، وتابع الطلاب المتصلين الآن وأوائل الطلاب تلقائياً.',
      liveSyncLabel: 'المزامنة المباشرة مفعّلة',
      refreshBtn: 'تحديث',
      privacyNote: 'حماية الخصوصية: يقتصر التتبع على الأنشطة التعليمية داخل التطبيق فقط (الاختبارات، الأسئلة المجابة، رسائل المعلم، والمذاكرة الذكية).',
      searchPlaceholder: 'ابحث عن الطلاب أو الأسئلة أو الفصول أو الرسائل بالاسم أو الكلمة المفتاحية...',
      searchClear: 'مسح',
      searching: 'جاري البحث في منصة الصف التاسع...',
      searchEmpty: 'لم يتم العثور على طلاب أو أسئلة أو فصول أو رسائل مطابقة.',
      filterAll: 'جميع النتائج',
      filterStudents: 'الطلاب',
      filterQuestions: 'الأسئلة',
      filterChapters: 'الفصول',
      filterMessages: 'الرسائل',
      activeStudentsTitle: 'الطلاب النشطون حالياً (متصلون الآن)',
      activeStudentsSub: 'الطلاب الذين يستخدمون المنصة الآن بشكل مباشر.',
      onlineNowBadge: 'متصل الآن',
      onlineLabel: 'متصل',
      offlineLabel: 'غير متصل',
      noActiveStudents: 'لا يوجد طلاب متصلون حالياً في هذه اللحظة.',
      viewingSection: 'يتصفح قسم',
      topStudentTitle: 'الطالب الأعلى أداءً (Top Student)',
      topStudentSub: 'يُحدَّد تلقائياً بناءً على درجات الاختبارات والإجابات الصحيحة والدقة.',
      noTopStudent: 'سيظهر التصنيف بمجرد إكمال الطلاب للأسئلة أو الاختبارات.',
      mostActiveTitle: 'الطالب الأكثر نشاطاً (Most Active)',
      mostActiveSub: 'يُبرز تلقائياً بناءً على المشاركة التعليمية وإجابة الأسئلة وإكمال الاختبارات.',
      noMostActive: 'سيظهر الأكثر نشاطاً مع تفاعل الطلاب مع الأنشطة التعليمية.',
      leaderboardTitle: 'أداء ونشاط جميع الطلاب',
      leaderboardSub: 'يتحدث التصنيف تلقائياً فور استخدام الطلاب للتطبيق وإجابة الأسئلة.',
      noStudentsYet: 'لا توجد حسابات طلاب مسجّلة بعد.',
      quizzesCompleted: 'الاختبارات',
      questionsAnswered: 'الأسئلة المجابة',
      correctAnswers: 'الصحيحة',
      accuracyLabel: 'الدقة',
      avgScore: 'متوسط الدرجة',
      bestScore: 'أعلى درجة',
      performanceScore: 'مؤشر الأداء',
      activityPoints: 'نقاط النشاط',
      teacherQuestions: 'أسئلة للمعلم',
      aiTutorTurns: 'تمارين الذكاء',
      lastActive: 'آخر نشاط',
      viewStatsBtn: 'عرض الإحصائيات',
      messageBtn: 'مراسلة',
      openChapterBtn: 'فتح الفصل',
      openChatBtn: 'فتح المحادثة',
      statsModalTitle: 'الإحصائيات التعليمية التفصيلية للطالب',
      recentAttemptsTitle: 'أحدث محاولات الاختبار',
      noStudentAttempts: 'لم يُكمل هذا الطالب اختباراً كاملاً بعد.',
      closeBtn: 'إغلاق',
      lastLogin: 'آخر تسجيل دخول',
      restrictedBadge: 'مقيّد',
      restrictBtn: 'تقييد',
      unrestrictBtn: 'إلغاء التقييد',
      restrictPromptTitle: 'تقييد تواصل الطالب',
      restrictReasonPlaceholder: 'اذكر سبب التقييد (مثلاً لغة غير لائقة أو رسائل مزعجة)...',
      confirmRestrictBtn: 'تأكيد التقييد',
      deleteUserBtn: 'حذف الحساب',
      deleteUserModalTitle: 'حذف حساب المستخدم نهائياً؟',
      deleteUserModalWarning: 'سيؤدي هذا إلى حذف الحساب نهائياً وإلغاء جميع جلساته النشطة فوراً ومسح محاولات الاختبار والنقاط والرسائل والمنشورات.',
      confirmDeleteUserBtn: 'حذف الحساب نهائياً',
      deletingUserBtn: 'جاري الحذف...',
      userDeletedSuccess: 'تم حذف حساب {name} نهائياً وإلغاء جلساته النشطة.',
      cannotDeleteSelf: 'لا يمكنك حذف حسابك النشط من لوحة تحكم المسؤول.',
      cannotDeleteMainAdmin: 'لا يمكن حذف حساب المسؤول الرئيسي.',
      monitoringTitle: 'مراقبة المجتمع وسجل النشاطات والسلامة',
      monitoringSub: 'مراجعة جميع المحادثات الخاصة والدردشات الجماعية وأوقات تسجيل الدخول وبلاغات السلامة.',
      tabOverview: 'نظرة عامة',
      tabPrivateDms: 'الرسائل الخاصة',
      tabGroupChats: 'الدردشات الجماعية',
      tabActivityLogs: 'سجل النشاطات',
      tabModeration: 'السلامة والبلاغات',
      statPosts: 'المنشورات',
      statComments: 'التعليقات',
      statReactions: 'التفاعلات',
      statPrivateDms: 'الرسائل الخاصة',
      statGroups: 'المجموعات',
      statGroupMsgs: 'رسائل المجموعات',
      statOpenReports: 'البلاغات المفتوحة',
      statRestrictedUsers: 'الحسابات المقيّدة',
      searchDmsPlaceholder: 'ابحث في المحادثات الخاصة باسم الطالب أو نص الرسالة...',
      noDmConversations: 'لا توجد محادثات خاصة بين الطلاب بعد.',
      selectDmConversation: 'اختر محادثة خاصة لعرض جميع الرسائل المتبادلة بين الطالبين.',
      messagesCountLabel: 'رسالة',
      deleteMsgBtn: 'حذف',
      deleteGroupBtn: 'حذف المجموعة',
      noGroupsFound: 'لم تُنشأ أي مجموعات دراسية بعد.',
      selectGroupInspect: 'اختر مجموعة لعرض جميع رسائلها وأعضائها.',
      privateGroupBadge: 'مجموعة خاصة',
      publicGroupBadge: 'مجموعة عامة',
      searchLogsPlaceholder: 'ابحث في سجل النشاطات باسم الطالب أو البريد أو التفاصيل...',
      allActionsFilter: 'جميع النشاطات',
      noLogsFound: 'لم يتم العثور على نشاطات مطابقة.',
      filterOpen: 'مفتوح',
      filterResolved: 'تمت المعالجة',
      filterDismissed: 'مرفوض',
      noReportsFound: 'لا توجد بلاغات في هذه القائمة.',
      reportedBy: 'بلاغ من',
      reportedTarget: 'المحتوى المبلّغ عنه',
      reportedReason: 'السبب',
      deleteReportedContent: 'حذف المحتوى',
      resolveBtn: 'تمت المعالجة',
      dismissBtn: 'تجاهل',
      statusOpen: 'مفتوح',
      statusResolved: 'معالج',
      statusDismissed: 'مرفوض',
      actionLabels: {
        login: 'تسجيل الدخول',
        register: 'تسجيل حساب',
        logout: 'تسجيل الخروج',
        online: 'أصبح متصلاً',
        offline: 'انقطع الاتصال',
        post_created: 'نشر منشور',
        post_deleted: 'حذف منشور',
        comment_created: 'إضافة تعليق',
        reaction_added: 'تفاعل',
        dm_sent: 'إرسال رسالة خاصة',
        group_created: 'إنشاء مجموعة',
        group_joined: 'انضمام لمجموعة',
        group_message_sent: 'رسالة جماعية',
        quiz_completed: 'إكمال اختبار',
        question_answered: 'إجابة سؤال',
        teacher_message_sent: 'مراسلة المعلم',
        ai_tutor_used: 'استخدام المعلم الذكي',
        content_reported: 'تقديم بلاغ',
        content_deleted: 'حذف محتوى',
        account_restricted: 'تقييد حساب',
        account_unrestricted: 'رفع التقييد',
        report_reviewed: 'مراجعة بلاغ',
      },
      tabBackups: 'النسخ الاحتياطي والاستعادة',
      backupTitle: 'حفظ قاعدة البيانات والنسخ الاحتياطي والاستعادة',
      backupSub: 'حفظ تلقائي لبيانات WAL ونسخ أمان قبل التحديثات مع إمكانية تنزيل واستعادة جميع الحسابات وكلمات المرور والدرجات والفصول والاختبارات والرسائل.',
      backupProtectionBadge: 'الحفظ التلقائي مفعّل',
      backupStatsAccounts: 'الحسابات المحفوظة',
      backupStatsQuestions: 'الأسئلة',
      backupStatsMessages: 'الرسائل',
      backupStatsAttempts: 'محاولات الاختبار',
      backupStatsDbSize: 'حجم قاعدة البيانات',
      backupLastSnapshot: 'آخر نسخة استعادة تلقائية',
      createBackupBtn: 'إنشاء نسخة احتياطية الآن',
      creatingBackup: 'جاري إنشاء النسخة...',
      downloadExportBtn: 'تنزيل نسخة كاملة (.json)',
      importBackupBtn: 'استعادة من ملف (.json)',
      restoreModeLabel: 'وضع الاستعادة',
      restoreModeMerge: 'دمج آمن (الحفاظ على الحسابات الأحدث واستعادة المفقود فقط)',
      restoreModeReplace: 'استبدال كامل (العودة لنقطة النسخة بعد أخذ نسخة أمان)',
      restoreBtn: 'استعادة',
      downloadFileBtn: 'تنزيل',
      deleteBackupBtn: 'حذف',
      latestSnapshotBadge: 'نسخة الاستعادة التلقائية',
      noBackupsYet: 'لا توجد نسخ احتياطية محفوظة بعد.',
      backupCreatedMsg: 'تم إنشاء نسخة احتياطية وتثبيتها على القرص بنجاح.',
      backupRestoredMsg: 'تمت استعادة النسخة الاحتياطية بنجاح مع الحفاظ على صلاحيات المسؤول.',
      backupConfirmReplace: 'سيتم استبدال السجلات الحالية بهذه النسخة بعد إنشاء نسخة أمان تلقائية. هل تريد المتابعة؟',
      aiDisabledNotice: 'تم إيقاف ستوديو الذكاء الاصطناعي مؤقتاً من قِبل المسؤول.',
      tabAccounts: 'الحسابات المسجّلة',
      tabContentControl: 'المحتوى والمنهج',
      tabAppSettings: 'إعدادات التطبيق',
      registeredAccountsSub: 'فحص جميع حسابات الطلاب والمعلمين، وتعديل الملفات الشخصية، وإدارة الصلاحيات، وتقييد الحسابات أو حذفها بأمان.',
      editProfileBtn: 'تعديل الملف',
      saveProfileBtn: 'حفظ التغييرات',
      contentControlTitle: 'التحكم بالمنهج والاختبارات والإعلانات',
      contentControlSub: 'انتقل مباشرة إلى تعديل أي فصل من علوم الصف التاسع أو الاختبارات أو الأسئلة العامة أو إعلانات الصف.',
      openQuizzesBtn: 'تعديل اختبارات الفصول',
      openGeneralQaBtn: 'تعديل الأسئلة العامة',
      openTextbooksQaBtn: 'تعديل الكتب والأسئلة الدراسية',
      openHomeAnnouncementsBtn: 'إدارة الإعلانات',
      appSettingsTitle: 'إعدادات التطبيق العامة والتحكم بالوصول',
      appSettingsSub: 'إعداد تسجيل الطلاب، ووصول مجتمع الطلاب، وستوديو الذكاء الاصطناعي، واللغة الافتراضية، وشريط التنبيهات.',
      settingAllowReg: 'السماح بتسجيل الطلاب الجدد',
      settingCommunityEnabled: 'تفعيل مجتمع الطلاب للطلاب',
      settingCommunityPosting: 'السماح بنشر المنشورات والتعليقات والرسائل',
      settingAiTutor: 'تفعيل ستوديو الذكاء الاصطناعي للطلاب',
      settingDefaultLang: 'اللغة الافتراضية',
      settingMaintenanceMsg: 'رسالة تنبيه عامة في التطبيق (اختياري)',
      settingMaintenancePlaceholder: 'اتركه فارغاً لإخفاء الشريط أو اكتب تنبيهاً لجميع المستخدمين...',
      saveSettingsBtn: 'حفظ إعدادات التطبيق',
      settingsSavedMsg: 'تم حفظ إعدادات التطبيق وتطبيقها فوراً.',
    },
    community: {
      title: 'مجتمع الطلاب',
      subtitle: 'تواصل مع زملائك المتصلين الآن، وشارك منشورات علوم الصف التاسع، وتبادل الرسائل الخاصة والدردشات الجماعية.',
      privacyBannerTitle: 'إشعار السلامة والخصوصية المدرسية',
      privacyBannerDesc: 'تُحفظ جميع المنشورات والتعليقات والرسائل الخاصة والدردشات الجماعية ونشاطات التطبيق بشكل آمن، ويمكن لمدير المدرسة (الأستاذ كسروان) مراجعتها لضمان بيئة تعليمية آمنة ومحترمة.',
      restrictedBannerTitle: 'صلاحيات المجتمع مقيّدة',
      restrictedBannerDefault: 'تم تقييد صلاحية النشر والمراسلة في مجتمع الطلاب من قِبل مدير المدرسة.',
      tabFeed: 'المنشورات التعليمية',
      tabActiveStudents: 'الطلاب المتصلون',
      tabPrivateMessages: 'الرسائل الخاصة',
      tabGroupChats: 'الدردشات الجماعية',
      onlineNowCount: 'متصل الآن',
      activeClassmatesTitle: 'الطلاب والزملاء النشطون',
      activeClassmatesSub: 'اعرف من المتصل حالياً في منصة الصف التاسع وابدأ محادثة دراسية.',
      onlineStatus: 'متصل',
      offlineStatus: 'غير متصل',
      studyingLabel: 'يتصفح',
      messagePeerBtn: 'مراسلة',
      reportUserBtn: 'إبلاغ',
      noPeersFound: 'لا يوجد زملاء مسجّلون بعد.',
      sharePlaceholder: 'شارك فائدة علمية للصف التاسع أو قانوناً أو سؤالاً مع زملائك...',
      chapterTagOptional: 'تحديد الفصل (اختياري)',
      noChapterTag: 'علوم عامة',
      attachFileBtn: 'إرفاق صورة / ملف',
      publishPostBtn: 'نشر المنشور',
      publishingPost: 'جاري النشر...',
      searchPostsPlaceholder: 'ابحث في المنشورات أو أسماء الزملاء...',
      allChaptersFilter: 'جميع الفصول',
      noPostsYet: 'لا توجد منشورات تعليمية بعد. كن أول من يشارك!',
      commentsLabel: 'التعليقات',
      writeCommentPlaceholder: 'اكتب تعليقاً مفيداً...',
      sendCommentBtn: 'تعليق',
      deleteBtn: 'حذف',
      reportBtn: 'إبلاغ',
      downloadAttachment: 'تنزيل المرفق',
      reactions: {
        like: 'إعجاب',
        helpful: 'مفيد',
        celebrate: 'ممتاز',
        insightful: 'ملهم',
      },
      dmThreadsTitle: 'رسائل الزملاء',
      searchClassmatesPlaceholder: 'ابحث عن زميل...',
      selectClassmatePrompt: 'اختر زميلاً لإرسال رسالة دراسية خاصة.',
      noDmMessages: 'لا توجد رسائل بعد. ألقِ التحية أو اسأل سؤالاً علمياً!',
      writeDmPlaceholder: 'اكتب رسالة خاصة...',
      sendBtn: 'إرسال',
      sendingBtn: 'جاري الإرسال...',
      backToList: 'رجوع',
      groupsTitle: 'مجموعات الدراسة',
      createGroupBtn: 'إنشاء مجموعة',
      createGroupTitle: 'إنشاء مجموعة دراسية',
      groupNameLabel: 'اسم المجموعة',
      groupNamePlaceholder: 'مثال: مجموعة مراجعة الفصل الرابع',
      groupDescLabel: 'الوصف (اختياري)',
      groupDescPlaceholder: 'الموضوعات أو خطة المراجعة...',
      groupVisibilityLabel: 'خصوصية المجموعة',
      groupPublicOpt: 'عامة (يمكن لأي طالب الانضمام)',
      groupPrivateOpt: 'خاصة (للمدعوين والمسؤول فقط)',
      selectMembersLabel: 'دعوة الزملاء',
      createGroupSubmit: 'إنشاء المجموعة',
      joinGroupBtn: 'انضمام',
      leaveGroupBtn: 'مغادرة',
      deleteGroupBtn: 'حذف المجموعة',
      addMemberLabel: 'إضافة زميل...',
      addMemberBtn: 'إضافة',
      membersCount: 'أعضاء',
      selectGroupPrompt: 'اختر مجموعة دراسية من القائمة أو أنشئ مجموعة جديدة.',
      joinToChatPrompt: 'انضم إلى هذه المجموعة العامة للمشاركة في الدردشة.',
      noGroupMessages: 'لا توجد رسائل في هذه المجموعة بعد.',
      writeGroupMsgPlaceholder: 'اكتب رسالة للمجموعة...',
      reportModalTitle: 'الإبلاغ عن محتوى أو سلوك غير لائق',
      reportModalDesc: 'تُرسل البلاغات مباشرة إلى مدير المدرسة (الأستاذ كسروان) للمراجعة الفورية.',
      reportReasonLabel: 'سبب الإبلاغ',
      reportReasonPlaceholder: 'اشرح سبب عدم ملاءمة هذا المحتوى أو الرسالة...',
      submitReportBtn: 'إرسال البلاغ',
      reportSubmittedMsg: 'تم إرسال بلاغ السلامة إلى مدير المدرسة.',
      cancelBtn: 'إلغاء',
      youLabel: 'أنت',
      teacherBadge: 'المسؤول / المعلم',
      restrictedUserTag: 'مقيّد',
      filterAllPeers: 'جميع الزملاء',
      filterOnlinePeers: 'متصلون',
      filterOfflinePeers: 'غير متصلين',
      communityDisabledNotice: 'تم تعطيل مجتمع الطلاب حالياً من قِبل مسؤول المدرسة.',
      postingPausedNotice: 'النشر والمراسلة متوقفان مؤقتاً في المجتمع (وضع القراءة فقط).',
    },
    competition: {
      title: 'مسابقة الطلاب ولوحة المتصدرين',
      subtitle: 'ترتيب طلاب منصة الصف التاسع بناءً على الاختبارات والإجابات الصحيحة والمشاركة العلمية.',
      podiumTitle: 'منصة الأبطال الثلاثة الأوائل',
      podiumSub: 'الطلاب المتصدرون الحائزون على الميداليات الذهبية والفضية والبرونزية.',
      firstPlace: 'المركز الأول · الذهبية',
      secondPlace: 'المركز الثاني · الفضية',
      thirdPlace: 'المركز الثالث · البرونزية',
      yourStandingTitle: 'مركزك ونقاطك الحالية',
      rankLabel: 'الترتيب',
      unrankedLabel: 'عرض المعلم',
      totalPointsLabel: 'مجموع النقاط',
      quizPointsLabel: 'نقاط الاختبارات',
      activityPointsLabel: 'نقاط الأنشطة',
      accuracyLabel: 'الدقة',
      quizzesLabel: 'الاختبارات',
      onlineLiveBadge: 'متصل · المزامنة المباشرة مفعّلة',
      offlineQueuedBadge: 'غير متصل · {count} بانتظار المزامنة ({pts} نقطة)',
      syncingBadge: 'جاري مزامنة النقاط المحفوظة...',
      syncReadyBadge: '{count} نشاط بانتظار المزامنة ({pts} نقطة)',
      syncedSuccessMsg: 'تمت مزامنة {count} نشاطاً وإضافة +{pts} نقطة.',
      syncNowBtn: 'مزامنة الآن',
      pendingPointsNotice: '+{pts} نقطة محفوظة محلياً — سترفع تلقائياً عند عودة الاتصال.',
      searchPlaceholder: 'ابحث عن طالب بالاسم أو الصف...',
      allStudentsTitle: 'التصنيف الكامل للطلاب',
      noStudentsYet: 'لا توجد نقاط مسجّلة بعد. أكمل اختباراً لتسجيل أولى النقاط!',
      youBadge: 'أنت',
      ptsUnit: 'نقطة',
      pointsRulesTitle: 'كيفية كسب النقاط',
      ruleCorrectAnswer: '+{pts} نقاط لكل إجابة صحيحة في الاختبار',
      ruleQuizCompleted: '+{pts} نقطة لإكمال اختبار كامل',
      ruleHighScore: '+{pts} نقطة إضافية عند تحقيق ٨٠٪ فأكثر',
      rulePerfectScore: '+{pts} نقطة إضافية عند تحقيق ١٠٠٪',
      ruleCurriculumActivity: '+{pts} نقاط عند استخدام الذكاء العلمي أو سؤال المعلم أو المجتمع',
      offlineNote: 'يُحفظ تقدّمك دون إنترنت بأمان على جهازك وتتم مزامنته تلقائياً فور عودة الاتصال.',
      recentHistoryTitle: 'سجل نقاطك الأخير',
      noHistoryYet: 'أجب عن أسئلة الاختبارات أو شارك في الأنشطة الدراسية لبدء جمع النقاط.',
      cachedOfflineNotice: 'يتم عرض التصنيف المحفوظ أثناء عدم الاتصال، مع احتساب النقاط المعلّقة على هذا الجهاز.',
      teacherViewNotice: 'حسابات المعلمين والمسؤولين تشرف على المسابقة ولا تدخل في ترتيب الطلاب.',
      rankCol: 'الترتيب',
      studentCol: 'الطالب',
      quizzesCol: 'الاختبارات',
      accuracyCol: 'الدقة',
      pointsCol: 'النقاط',
      eventCorrectAnswer: 'إجابة صحيحة في اختبار',
      eventQuizCompleted: 'إكمال اختبار',
      eventCurriculumActivity: 'نشاط منهجي',
    },
    textbooks: {
      title: 'الكتب المدرسية والأسئلة والأجوبة',
      subtitle: 'أدلة فصول كتاب العلوم للصف التاسع، والقوانين الدولية القياسية، والملفات الدراسية، والأسئلة المنظمة مع الشرح المفصل.',
      allOverviewTab: 'نظرة عامة على الفصول',
      chapterTabPrefix: 'الفصل',
      generalTabLabel: 'البنك العام',
      searchPlaceholder: 'ابحث في المواضيع أو القوانين أو الأسئلة أو الشروحات...',
      filterAll: 'جميع الأسئلة والأجوبة',
      filterWorked: 'أمثلة الكتاب المحلولة',
      filterCurriculum: 'بنك أسئلة المنهج',
      revealAllBtn: 'إظهار جميع الإجابات',
      hideAllBtn: 'إخفاء الإجابات',
      practiceChapterBtn: 'ابدأ اختبار هذا الفصل',
      addTextbookBtn: 'إضافة كتاب / ملف PDF',
      addQaBtn: 'إضافة سؤال وجواب',
      shelfTitle: 'كتب علوم الصف التاسع وأدلة الفصول',
      shelfSub: 'ملخصات الفصول الأساسية، معادلات الوحدات الدولية SI، وملفات PDF المرفوعة من المعلم.',
      chapterGuideTitle: 'دليل الكتاب والملفات للفصل',
      keyFormulasLabel: 'القوانين والمعادلات الأساسية (SI)',
      attachedFileLabel: 'ملف الكتاب',
      openLinkLabel: 'فتح رابط المرجع',
      downloadBtn: 'تنزيل',
      teacherMaterialsTitle: 'المواد الدراسية المرفوعة من المعلم',
      noResourcesForChapter: 'لم تتم إضافة ملف كتاب PDF أو دليل لهذا الفصل بعد.',
      qaSectionTitle: 'أسئلة الدراسة المنظمة والإجابات والشروحات',
      qaSectionSub: 'اضغط على أي سؤال لعرض الإجابة المعتمدة والشرح التفصيلي خطوة بخطوة.',
      qaCountLabel: 'سؤال وجواب',
      showAnswerBtn: 'عرض الإجابة والشرح',
      hideAnswerBtn: 'إخفاء الإجابة',
      correctAnswerHeading: 'الإجابة المعتمدة',
      explanationHeading: 'الشرح التفصيلي',
      workedBadge: 'مثال كتاب محلول',
      curriculumBadge: 'سؤال منهجي',
      generalScopeLabel: 'علوم عامة',
      noQaFound: 'لا توجد أسئلة وأجوبة مطابقة',
      noQaSub: 'جرّب اختيار فصل آخر أو مسح كلمة البحث أعلاه.',
      loadingTextbooks: 'جاري تحميل الكتب المدرسية والأسئلة والأجوبة...',
      offlineCacheNotice: 'وضع الدراسة دون إنترنت — يتم عرض الكتب والأسئلة المحفوظة محلياً.',
      resourceTypes: {
        textbook: 'كتاب مدرسي',
        guide: 'دليل فصل',
        summary: 'ملخص',
        slides: 'شرائح درس',
      },
      formResourceTitle: 'إضافة ملف كتاب PDF أو دليل دراسة للفصل',
      formTitleLabel: 'العنوان',
      formChapterLabel: 'الفصل (١–١١ أو عام)',
      formAllOverviewOpt: 'مرجع عام / الكتاب الكامل',
      formTypeLabel: 'نوع المرجع',
      formSummaryLabel: 'ملخص الفصل والمفاهيم الأساسية',
      formFormulasLabel: 'المعادلات الأساسية (حافظ على رموز الوحدات باللاتينية: N, kg, m, s, J, W)',
      formExternalUrlLabel: 'رابط خارجي (اختياري)',
      formAttachFileLabel: 'إرفاق ملف PDF أو صورة أو مستند (اختياري)',
      formSaveResourceBtn: 'نشر المرجع المدرسي',
      formQaTitle: 'إضافة سؤال وجواب دراسي',
      formEditQaTitle: 'تعديل سؤال وجواب',
      formQuestionLabel: 'نص السؤال الدراسي',
      formAnswerLabel: 'الإجابة الصحيحة',
      formExplanationLabel: 'الشرح التفصيلي خطوة بخطوة',
      formSourceLabel: 'وسم المصدر (مثال: الفصل ١ · مثال الكتاب)',
      formSaveQaBtn: 'حفظ السؤال والجواب',
      formUpdateQaBtn: 'تحديث السؤال والجواب',
      formCancelBtn: 'إلغاء',
      savingMsg: 'جاري الحفظ...',
      resourceAddedMsg: 'تم نشر المرجع المدرسي وحفظه في النسخ الدائم.',
      qaSavedMsg: 'تم حفظ السؤال والجواب بنجاح.',
      deleteConfirmBtn: 'حذف',
      officialBookTitle: 'كتاب العلوم الرسمي للصف التاسع',
      officialBookMeta: '٣٠٦ صفحة · الفصول ١–١١ · PDF',
      officialBookDesc: 'عاين جميع صفحات الكتاب مباشرة داخل التطبيق، وانتقل فوراً إلى أي فصل، أو نزّل الكتاب للدراسة دون إنترنت.',
      previewBookBtn: 'معاينة الكتاب',
      previewChapterPageBtn: 'قراءة في الكتاب',
      previewPdfBtn: 'معاينة في التطبيق',
      pageLabel: 'صفحة',
      ofPagesLabel: 'من',
      prevPageBtn: 'السابق',
      nextPageBtn: 'التالي',
      coverLabel: 'الغلاف',
      contentsLabel: 'الفهرس',
      fitWidthBtn: 'ملاءمة العرض',
      openNewTabBtn: 'فتح الملف',
      loadingPageMsg: 'جاري تحميل صفحة الكتاب...',
      pdfLoadErrorMsg: 'تعذّر عرض ملف PDF داخل التطبيق. يمكنك فتح الملف أو تنزيله مباشرة أدناه.',
      closeReaderBtn: 'إغلاق القارئ',
      contentsJumpBtn: 'الفهرس (ص.٢)',
      fullBookBtn: 'الكتاب الكامل (ص.١)',
      allChaptersTextbookGridTitle: 'فصول الكتاب الرسمي (١–١١)',
      allChaptersTextbookGridSub: 'انتقل مباشرة إلى أي فصل داخل كتاب Science_9_Book.pdf (٣٠٦ صفحة).',
      readChapterPdfBtn: 'فتح الفصل',
      textbookShortLabel: 'الكتاب',
      readFullTextbookBtn: 'قراءة الكتاب (٣٠٦ ص.)',
      previewTextbookBtn: 'معاينة الكتاب PDF',
    },
  },
};
