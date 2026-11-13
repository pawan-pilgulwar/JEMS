/** Client-safe constants for the industry portal (no DB imports here). */

export const APPLICATION_STATUSES = ["Applied", "In review", "Shortlisted", "Interview", "Offer", "Rejected"] as const;
export type CompanyApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const OPPORTUNITY_TYPES = ["Internship", "Apprenticeship", "Project", "Full-time"] as const;
export const PROGRAM_TYPES = ["Training", "Certification", "Workshop", "Mentorship"] as const;
export const COLLABORATION_TYPES = ["FDP", "Faculty Internship", "Industrial Training", "Guest Lecture", "Research", "Consultancy", "Innovation Challenge", "Live Project"] as const;

/** A student's application to an industry learning program. */
export const ENROLLMENT_STATUSES = ["Applied", "Accepted", "Waitlisted", "Rejected", "Completed"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** A faculty member's (or institution's) interest in a collaboration, as the company triages it. */
export const INTEREST_STATUSES = ["Interested", "Accepted", "Declined"] as const;
export type InterestStatus = (typeof INTEREST_STATUSES)[number];

/** Programs and collaborations can be closed to new applications / interest. */
export const LISTING_STATUSES = ["open", "closed"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
