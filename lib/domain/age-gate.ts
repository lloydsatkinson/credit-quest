import type { AgeMode } from "@/lib/domain/types";

export function getAgeYears(dateOfBirth: string, now = new Date()): number {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Invalid date of birth");

  let age = now.getUTCFullYear() - year;
  const monthDiff = now.getUTCMonth() + 1 - month;
  const beforeBirthday = monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

export function getAgeMode(dateOfBirth: string, now = new Date()): AgeMode {
  return getAgeYears(dateOfBirth, now) >= 18 ? "adult" : "education";
}
