import { AresProfile } from "./models";

export class ProfileRepository {
  private readonly profiles = new Map<string, AresProfile>();

  save(profile: AresProfile): AresProfile {
    this.profiles.set(profile.id, profile);
    return profile;
  }

  get(id: string): AresProfile | undefined {
    return this.profiles.get(id);
  }

  getAll(): AresProfile[] {
    return [...this.profiles.values()];
  }

  delete(id: string): boolean {
    return this.profiles.delete(id);
  }
}
