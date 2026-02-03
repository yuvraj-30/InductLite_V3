import type { Mock } from "vitest";

// Helper to mock resolved values of Prisma delegates with proper typing.
// Call sites pass the specific Mock and the expected return value type,
// e.g. mockDelegateResolvedValue(prisma.user.findFirst as Mock, userPayload)
export function mockDelegateResolvedValue<
  D extends (...args: unknown[]) => unknown,
  V = Awaited<ReturnType<D>>,
>(fn: Mock, value: V) {
  return fn.mockResolvedValue(value);
}

// Helper for non-async returns
export function mockDelegateReturnValue<
  D extends (...args: unknown[]) => unknown,
  V = ReturnType<D>,
>(fn: Mock, value: V) {
  return fn.mockReturnValue(value);
}
