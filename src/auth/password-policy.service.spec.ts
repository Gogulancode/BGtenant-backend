import { BadRequestException } from "@nestjs/common";
import { PasswordPolicyService } from "./password-policy.service";

describe("PasswordPolicyService", () => {
  let service: PasswordPolicyService;

  beforeEach(() => {
    service = new PasswordPolicyService();
  });

  it("accepts strong passwords", () => {
    expect(() => service.assertStrong("Str0ng!Passw0rd")).not.toThrow();
  });

  it("rejects weak passwords", () => {
    expect(() => service.assertStrong("weakpass")).toThrow(BadRequestException);
  });
});
