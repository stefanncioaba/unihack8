package com.unihack8.backend.users.domain;

/** Limits of profile skills (PLAN 28). Categories are the Help Board ones (HelpRules.CATEGORY_ORDER). */
public final class SkillRules {

    public static final int NAME_MIN = 2;
    public static final int NAME_MAX = 40;
    // Most skills one person can list.
    public static final int MAX_PER_USER = 10;

    // Constants only.
    private SkillRules() {
    }
}
