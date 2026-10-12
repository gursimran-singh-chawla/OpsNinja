import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  generateOtp,
  hashOtp,
  register,
  verifyEmail,
  resendVerification,
  login,
  onboardUser,
} from "./auth.service.js";
import { verifyTurnstileToken } from "./turnstile.service.js";
import { sendVerificationEmail } from "./email.service.js";
import { prisma } from "../../lib/prisma.js";
import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("./email.service.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../audit/audit.service.js", () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

describe("Authentication & Email Verification Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("OTP Generation & Hashing", () => {
    it("generates cryptographically secure 6-digit numeric OTPs", () => {
      for (let i = 0; i < 50; i++) {
        const otp = generateOtp();
        expect(otp).toMatch(/^\d{6}$/);
        const num = parseInt(otp, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThan(1000000);
      }
    });

    it("hashes OTP with sha256 hex encoding", () => {
      const code = "123456";
      const hash1 = hashOtp(code);
      const hash2 = hashOtp(code);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).not.toBe(code);
    });
  });

  describe("Registration", () => {
    it("creates an unverified user (emailVerifiedAt = null) and dispatches OTP email", async () => {
      const email = `test.unverified.${Date.now()}@example.com`;
      const result = await register({
        email,
        name: "Test User",
        password: "Password123!",
        role: "associate",
      });

      expect(result).toEqual({
        email: email.toLowerCase(),
        verificationRequired: true,
      });

      // Verify DB record state
      const created = await prisma.user.findUnique({ where: { email } });
      expect(created).not.toBeNull();
      expect(created?.emailVerifiedAt).toBeNull();
      expect(created?.emailVerificationCodeHash).toBeDefined();
      expect(created?.emailVerificationCodeHash).toHaveLength(64);
      expect(created?.emailVerificationExpiresAt).toBeDefined();
      expect(created?.emailVerificationExpiresAt!.getTime()).toBeGreaterThan(Date.now());
      expect(created?.emailVerificationAttempts).toBe(0);
      expect(created?.emailVerificationSentAt).toBeDefined();

      // Email service was invoked
      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          name: "Test User",
          code: expect.stringMatching(/^\d{6}$/),
        }),
      );

      // Cleanup
      await prisma.user.delete({ where: { id: created!.id } });
    });

    it("rejects duplicate email registrations when account is already verified", async () => {
      const email = `test.dup.${Date.now()}@example.com`;
      await register({
        email,
        name: "First User",
        password: "Password123!",
        role: "associate",
      });

      const call = vi.mocked(sendVerificationEmail).mock.calls.find((c) => c[0].to === email);
      await verifyEmail(email, call![0].code);

      await expect(
        register({
          email,
          name: "Second User",
          password: "Password123!",
          role: "associate",
        }),
      ).rejects.toThrow(/Email already in use/);

      // Cleanup
      await prisma.session.deleteMany({ where: { user: { email } } });
      await prisma.user.delete({ where: { email } });
    });

    it("allows retrying signup if previous attempt was unverified", async () => {
      const email = `test.retry.${Date.now()}@example.com`;
      await register({
        email,
        name: "First Attempt",
        password: "Password123!",
        role: "associate",
      });

      // Retrying signup with the same unverified email should succeed, updating details and sending new OTP
      const secondAttempt = await register({
        email,
        name: "Updated Name",
        password: "NewPassword456!",
        role: "manager",
      });
      expect(secondAttempt.verificationRequired).toBe(true);

      const userInDb = await prisma.user.findUnique({ where: { email } });
      expect(userInDb?.name).toBe("Updated Name");
      expect(userInDb?.role).toBe("manager");

      // Cleanup
      await prisma.user.delete({ where: { email } });
    });

    it("does not save user in database if signup encounters email dispatch failure", async () => {
      const email = `test.sendfail.${Date.now()}@example.com`;
      vi.mocked(sendVerificationEmail).mockRejectedValueOnce(new Error("EmailJS provider rejection"));

      await expect(
        register({
          email,
          name: "Send Fail User",
          password: "Password123!",
          role: "associate",
        }),
      ).rejects.toThrow("EmailJS provider rejection");

      // Verify user was NOT saved in database
      const userInDb = await prisma.user.findUnique({ where: { email } });
      expect(userInDb).toBeNull();

      // User can retry immediately without "Email already in use" conflict
      vi.mocked(sendVerificationEmail).mockResolvedValueOnce(undefined);
      const retryResult = await register({
        email,
        name: "Send Fail User",
        password: "Password123!",
        role: "associate",
      });
      expect(retryResult.verificationRequired).toBe(true);

      // Cleanup
      await prisma.user.delete({ where: { email } });
    });
  });

  describe("Email Verification (/verify-email)", () => {
    it("successfully verifies with valid OTP, clears OTP secrets, and marks pending admin approval", async () => {
      const email = `test.verify.${Date.now()}@example.com`;
      await register({
        email,
        name: "Verify Target",
        password: "Password123!",
        role: "associate",
      });

      // Retrieve the code sent via email mock
      const call = vi.mocked(sendVerificationEmail).mock.calls.find((c) => c[0].to === email);
      const code = call![0].code;

      const verified = await verifyEmail(email, code);
      expect(verified.approved).toBe(false);
      expect(verified.sessionId).toBeUndefined();
      expect(verified.user.email).toBe(email);
      expect(verified.user.emailVerifiedAt).toBeDefined();

      // Ensure database state was updated and secrets cleared
      const userInDb = await prisma.user.findUnique({ where: { email } });
      expect(userInDb?.emailVerifiedAt).not.toBeNull();
      expect(userInDb?.approvedAt).toBeNull();
      expect(userInDb?.emailVerificationCodeHash).toBeNull();
      expect(userInDb?.emailVerificationExpiresAt).toBeNull();
      expect(userInDb?.emailVerificationAttempts).toBe(0);
      expect(userInDb?.emailVerificationSentAt).toBeNull();

      // Attempting to log in before admin approval is rejected with 403 account_pending_approval
      await expect(login(email, "Password123!", "127.0.0.1")).rejects.toThrow(
        /account is waiting for administrator approval/
      );

      // Once admin approves account, login succeeds and session is issued
      await prisma.user.update({
        where: { id: userInDb!.id },
        data: { approvedAt: new Date() },
      });

      const loggedIn = await login(email, "Password123!", "127.0.0.1");
      expect(loggedIn.sessionId).toBeDefined();
      expect(loggedIn.user.approvedAt).toBeDefined();

      // Cleanup session & user
      await prisma.session.delete({ where: { id: loggedIn.sessionId } });
      await prisma.user.delete({ where: { id: userInDb!.id } });
    });

    it("rejects invalid OTP and increments attempt count", async () => {
      const email = `test.invalid.${Date.now()}@example.com`;
      await register({
        email,
        name: "Invalid OTP Target",
        password: "Password123!",
        role: "associate",
      });

      await expect(verifyEmail(email, "000000")).rejects.toThrow("Invalid verification code");

      const userInDb = await prisma.user.findUnique({ where: { email } });
      expect(userInDb?.emailVerificationAttempts).toBe(1);

      // Cleanup
      await prisma.user.delete({ where: { id: userInDb!.id } });
    });

    it("locks and invalidates OTP upon fifth incorrect attempt", async () => {
      const email = `test.attempts.${Date.now()}@example.com`;
      await register({
        email,
        name: "Attempt Limit Target",
        password: "Password123!",
        role: "associate",
      });

      // Submit 4 incorrect attempts
      for (let i = 0; i < 4; i++) {
        await expect(verifyEmail(email, "000000")).rejects.toThrow("Invalid verification code");
      }

      // 5th incorrect attempt invalidates the OTP and returns rate_limited error
      await expect(verifyEmail(email, "000000")).rejects.toThrow(/Too many incorrect verification attempts/);

      const userInDb = await prisma.user.findUnique({ where: { email } });
      expect(userInDb?.emailVerificationCodeHash).toBeNull();
      expect(userInDb?.emailVerificationExpiresAt).toBeNull();
      expect(userInDb?.emailVerificationAttempts).toBe(5);

      // Cleanup
      await prisma.user.delete({ where: { id: userInDb!.id } });
    });

    it("rejects expired OTPs", async () => {
      const email = `test.expired.${Date.now()}@example.com`;
      await register({
        email,
        name: "Expired Target",
        password: "Password123!",
        role: "associate",
      });

      // Manually backdate expiration to 1 minute ago
      await prisma.user.update({
        where: { email },
        data: { emailVerificationExpiresAt: new Date(Date.now() - 60 * 1000) },
      });

      await expect(verifyEmail(email, "123456")).rejects.toThrow("Verification code has expired");

      // Cleanup
      await prisma.user.delete({ where: { email } });
    });

    it("prevents already verified accounts from gaining sessions through /verify-email", async () => {
      const email = `test.already.verified.${Date.now()}@example.com`;
      await register({
        email,
        name: "Already Verified",
        password: "Password123!",
        role: "associate",
      });

      const call = vi.mocked(sendVerificationEmail).mock.calls.find((c) => c[0].to === email);
      const code = call![0].code;

      // Pre-approve user so verification issues session
      await prisma.user.update({
        where: { email },
        data: { approvedAt: new Date() },
      });

      // Verify once
      const session1 = await verifyEmail(email, code);
      expect(session1.sessionId).toBeDefined();

      // Subsequent attempt on already verified email must be rejected
      await expect(verifyEmail(email, code)).rejects.toThrow("Email is already verified. Please sign in.");

      // Cleanup
      await prisma.session.delete({ where: { id: session1.sessionId } });
      await prisma.user.delete({ where: { email } });
    });
  });

  describe("Resend Verification (/resend-verification)", () => {
    it("enforces 60-second cooldown between resends", async () => {
      const email = `test.cooldown.${Date.now()}@example.com`;
      await register({
        email,
        name: "Cooldown Target",
        password: "Password123!",
        role: "associate",
      });

      // Immediate resend should trigger 60s cooldown
      await expect(resendVerification(email)).rejects.toThrow(/Please wait \d+ seconds before requesting a new code/);

      // Fast-forward cooldown by updating sent timestamp
      await prisma.user.update({
        where: { email },
        data: { emailVerificationSentAt: new Date(Date.now() - 65 * 1000) },
      });

      const res = await resendVerification(email);
      expect(res.ok).toBe(true);

      // Cleanup
      await prisma.user.delete({ where: { email } });
    });

    it("generates a new OTP, replaces old hash, and resets attempts", async () => {
      const email = `test.resend.reset.${Date.now()}@example.com`;
      await register({
        email,
        name: "Reset Target",
        password: "Password123!",
        role: "associate",
      });

      const userBefore = await prisma.user.findUnique({ where: { email } });
      const oldHash = userBefore?.emailVerificationCodeHash;

      // Set some attempts and backdate sentAt
      await prisma.user.update({
        where: { email },
        data: {
          emailVerificationAttempts: 3,
          emailVerificationSentAt: new Date(Date.now() - 65 * 1000),
        },
      });

      await resendVerification(email);

      const userAfter = await prisma.user.findUnique({ where: { email } });
      expect(userAfter?.emailVerificationAttempts).toBe(0);
      expect(userAfter?.emailVerificationCodeHash).not.toBe(oldHash);
      expect(userAfter?.emailVerificationCodeHash).toBeDefined();

      // Cleanup
      await prisma.user.delete({ where: { email } });
    });

    it("returns generic success without leaking account existence for non-existent emails", async () => {
      const res = await resendVerification("nonexistent-person-99@example.com");
      expect(res.ok).toBe(true);
      expect(res.message).toContain("If an unverified account exists");
    });

    it("reverts sent timestamp when resend email dispatch fails", async () => {
      const email = `test.resendfail.${Date.now()}@example.com`;
      await register({
        email,
        name: "Resend Fail User",
        password: "Password123!",
        role: "associate",
      });

      // Backdate initial sentAt so cooldown is satisfied
      const initialSentAt = new Date(Date.now() - 70 * 1000);
      await prisma.user.update({
        where: { email },
        data: { emailVerificationSentAt: initialSentAt },
      });

      // Mock email failure on resend
      vi.mocked(sendVerificationEmail).mockRejectedValueOnce(new Error("Network timeout"));

      await expect(resendVerification(email)).rejects.toThrow("Network timeout");

      const userAfter = await prisma.user.findUnique({ where: { email } });
      // Sent timestamp reverted to initialSentAt, NOT updated to now
      expect(userAfter?.emailVerificationSentAt?.getTime()).toBe(initialSentAt.getTime());

      // Cleanup
      await prisma.user.delete({ where: { email } });
    });
  });

  describe("Login Security Boundaries", () => {
    it("strictly rejects unverified users with email_not_verified (403)", async () => {
      const email = `test.login.unverified.${Date.now()}@example.com`;
      await register({
        email,
        name: "Unverified Login",
        password: "Password123!",
        role: "associate",
      });

      await expect(login(email, "Password123!", "127.0.0.1")).rejects.toThrow(
        "Please verify your email before signing in",
      );

      // Verify the error has code email_not_verified
      try {
        await login(email, "Password123!", "127.0.0.1");
      } catch (err: any) {
        expect(err.code).toBe("email_not_verified");
        expect(err.status).toBe(403);
      }

      // Cleanup
      await prisma.user.delete({ where: { email } });
    });

    it("allows verified and approved users to log in normally", async () => {
      const email = `test.login.verified.${Date.now()}@example.com`;
      await register({
        email,
        name: "Verified Login",
        password: "Password123!",
        role: "associate",
      });

      const call = vi.mocked(sendVerificationEmail).mock.calls.find((c) => c[0].to === email);
      const code = call![0].code;
      await verifyEmail(email, code);

      // Attempting to log in before admin approval is blocked with account_pending_approval
      await expect(login(email, "Password123!", "127.0.0.1")).rejects.toThrow(
        /account is waiting for administrator approval/
      );

      // Admin approves the account
      await prisma.user.update({
        where: { email },
        data: { approvedAt: new Date() },
      });

      const session = await login(email, "Password123!", "127.0.0.1");
      expect(session.sessionId).toBeDefined();
      expect(session.user.email).toBe(email);

      // Cleanup
      await prisma.session.deleteMany({ where: { user: { email } } });
      await prisma.user.delete({ where: { email } });
    });
  });

  describe("Admin Onboarded Users", () => {
    it("creates immediately verified and approved users without requiring OTP verification", async () => {
      const email = `admin.onboarded.${Date.now()}@example.com`;
      const onboarded = await onboardUser("admin-id", {
        email,
        name: "Onboarded Member",
        password: "Password123!",
        role: "associate",
      });

      expect(onboarded.emailVerifiedAt).toBeDefined();
      expect(onboarded.approvedAt).toBeDefined();

      const session = await login(email, "Password123!", "127.0.0.1");
      expect(session.sessionId).toBeDefined();
      expect(session.user.email).toBe(email);

      // Cleanup
      await prisma.session.delete({ where: { id: session.sessionId } });
      await prisma.user.delete({ where: { id: onboarded.id } });
    });
  });

  describe("Turnstile Bot Verification Service", () => {
    it("allows bypass in dev/test when secret key is not set", async () => {
      const origKey = env.TURNSTILE_SECRET_KEY;
      try {
        env.TURNSTILE_SECRET_KEY = "";
        const ok = await verifyTurnstileToken(undefined, "127.0.0.1");
        expect(ok).toBe(true);
      } finally {
        env.TURNSTILE_SECRET_KEY = origKey;
      }
    });

    it("requires token when secret key is configured", async () => {
      const origKey = env.TURNSTILE_SECRET_KEY;
      try {
        env.TURNSTILE_SECRET_KEY = "test-secret-key";
        await expect(verifyTurnstileToken(undefined, "127.0.0.1")).rejects.toThrow(
          "Please complete the security verification challenge",
        );
      } finally {
        env.TURNSTILE_SECRET_KEY = origKey;
      }
    });
  });
});
