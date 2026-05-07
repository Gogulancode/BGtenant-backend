import { BadRequestException, Injectable } from "@nestjs/common";

@Injectable()
export class PasswordPolicyService {
  private readonly policyRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

  assertStrong(password: string) {
    if (!this.policyRegex.test(password)) {
      throw new BadRequestException(
        "Password must be at least 10 characters and include upper, lower, number, and symbol characters.",
      );
    }
  }
}
