'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const publicActivities = require('../src/lib/regional-catalog.json');
const { places: checkInPlaces } = require('../src/lib/checkin-policy');

const publicActivityById = new Map(
  publicActivities.map((activity) => [activity.id, activity]),
);
const checkInPlaceById = new Map(
  checkInPlaces.map((place) => [place.activityId, place]),
);

const scrypt = promisify(crypto.scrypt);
const STORE_VERSION = 1;
const HASH_LENGTH = 64;
const USERNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._-]{2,23}$/u;

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function normalizeUsername(input) {
  if (typeof input !== 'string')
    throw new AuthError(400, '아이디를 입력해 주세요.');
  const username = input.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
  if (!USERNAME_PATTERN.test(username))
    throw new AuthError(
      400,
      '아이디는 문자나 숫자로 시작하는 3~24자의 문자·숫자·점·밑줄·하이픈으로 입력해 주세요.',
    );
  return username;
}

function validatePassword(input) {
  if (typeof input !== 'string' || input.length < 12 || input.length > 128)
    throw new AuthError(400, '비밀번호는 12~128자로 입력해 주세요.');
  if (Buffer.byteLength(input, 'utf8') > 256 || input.includes('\0'))
    throw new AuthError(400, '비밀번호 형식을 확인해 주세요.');
  return input;
}

async function createPasswordHash(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, HASH_LENGTH);
  return {
    algorithm: 'scrypt',
    salt: salt.toString('base64url'),
    hash: hash.toString('base64url'),
    keyLength: HASH_LENGTH,
  };
}

async function verifyPassword(password, passwordRecord) {
  try {
    if (
      passwordRecord?.algorithm !== 'scrypt' ||
      passwordRecord?.keyLength !== HASH_LENGTH
    )
      return false;
    const expected = Buffer.from(passwordRecord.hash, 'base64url');
    const actual = await scrypt(
      password,
      Buffer.from(passwordRecord.salt, 'base64url'),
      HASH_LENGTH,
    );
    return (
      expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}

const dummyPasswordRecord = createPasswordHash(
  'dummy-password-used-only-to-equalize-login-time',
);

function emptyStore() {
  return { version: STORE_VERSION, users: [], sessions: [] };
}

function assertStore(data) {
  if (
    !data ||
    data.version !== STORE_VERSION ||
    !Array.isArray(data.users) ||
    !Array.isArray(data.sessions)
  )
    throw new Error('인증 저장소 형식이 올바르지 않습니다.');
  return data;
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
  };
}

class AuthStore {
  constructor(filePath, { sessionTtlMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
    this.filePath = path.resolve(filePath);
    this.sessionTtlMs = sessionTtlMs;
    this.queue = Promise.resolve();
    this.readyPromise = this.initialize();
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), {
      recursive: true,
      mode: 0o700,
    });
    try {
      await fs.access(this.filePath);
      await fs.chmod(this.filePath, 0o600);
    } catch {
      await this.writeData(emptyStore());
    }
  }

  async readData() {
    return assertStore(JSON.parse(await fs.readFile(this.filePath, 'utf8')));
  }

  async writeData(data) {
    const temporary = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    await fs.rename(temporary, this.filePath);
    await fs.chmod(this.filePath, 0o600);
  }

  async transaction(callback) {
    await this.readyPromise;
    const operation = this.queue.then(async () => {
      const data = await this.readData();
      const result = await callback(data);
      await this.writeData(data);
      return result;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  issueSession(data, userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    data.sessions = data.sessions.filter(
      (session) => session.expiresAt > now && session.userId !== userId,
    );
    data.sessions.push({
      tokenHash: crypto.createHash('sha256').update(token).digest('base64url'),
      userId,
      createdAt: now,
      expiresAt: now + this.sessionTtlMs,
    });
    return token;
  }

  async register(rawUsername, rawPassword) {
    const username = normalizeUsername(rawUsername);
    const password = validatePassword(rawPassword);
    const passwordRecord = await createPasswordHash(password);
    return this.transaction((data) => {
      if (data.users.some((user) => user.username === username))
        throw new AuthError(409, '이미 사용 중인 아이디입니다.');
      const user = {
        id: crypto.randomUUID(),
        username,
        password: passwordRecord,
        createdAt: new Date().toISOString(),
        profile: {
          display_name: username,
          balance: 0,
          interests: [],
          gender: 'unspecified',
        },
        checkIns: [],
        ledger: [],
      };
      data.users.push(user);
      return {
        user: publicUser(user),
        token: this.issueSession(data, user.id),
      };
    });
  }

  async login(rawUsername, rawPassword) {
    const username = normalizeUsername(rawUsername);
    const password = validatePassword(rawPassword);
    await this.readyPromise;
    const data = await this.readData();
    const user = data.users.find(
      (candidate) => candidate.username === username,
    );
    const valid = await verifyPassword(
      password,
      user?.password || (await dummyPasswordRecord),
    );
    if (!user || !valid)
      throw new AuthError(401, '아이디 또는 비밀번호를 확인해 주세요.');
    return this.transaction((latest) => {
      const current = latest.users.find(
        (candidate) => candidate.id === user.id,
      );
      if (!current)
        throw new AuthError(401, '아이디 또는 비밀번호를 확인해 주세요.');
      return {
        user: publicUser(current),
        token: this.issueSession(latest, current.id),
      };
    });
  }

  async session(token) {
    if (typeof token !== 'string' || token.length < 32) return null;
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('base64url');
    return this.transaction((data) => {
      const now = Date.now();
      data.sessions = data.sessions.filter((item) => item.expiresAt > now);
      const session = data.sessions.find(
        (item) => item.tokenHash === tokenHash,
      );
      if (!session) return null;
      const user = data.users.find((item) => item.id === session.userId);
      return user ? publicUser(user) : null;
    });
  }

  async logout(token) {
    if (typeof token !== 'string' || !token) return;
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('base64url');
    await this.transaction((data) => {
      data.sessions = data.sessions.filter(
        (item) => item.tokenHash !== tokenHash,
      );
    });
  }

  async account(userId) {
    await this.readyPromise;
    const data = await this.readData();
    const user = data.users.find((item) => item.id === userId);
    if (!user) throw new AuthError(401, '다시 로그인해 주세요.');
    return {
      profile: [user.profile],
      saved: [],
      coupons: [],
      ledger: user.ledger || [],
      participations: (user.checkIns || []).map((checkIn) => ({
        id: checkIn.id,
        activity_id: checkIn.activityId,
        region: checkIn.region,
        note: `GPS ${checkIn.distanceMeters}m · 정확도 ${checkIn.accuracyMeters}m`,
        status: 'approved',
        created_at: checkIn.createdAt,
        activities: checkIn.activity,
      })),
    };
  }

  async recordCheckIn(userId, evidence) {
    return this.transaction((data) => {
      const user = data.users.find((item) => item.id === userId);
      if (!user) throw new AuthError(401, '다시 로그인해 주세요.');
      user.checkIns ||= [];
      user.ledger ||= [];
      if (
        user.checkIns.some(
          (checkIn) =>
            checkIn.activityId === evidence.place.activityId ||
            (checkIn.venueKey ||
              checkInPlaceById.get(checkIn.activityId)?.venueKey) ===
              evidence.place.venueKey,
        )
      )
        throw new AuthError(409, '이미 GPS 인증과 적립을 완료한 장소입니다.');
      const createdAt = new Date().toISOString();
      const id = crypto.randomUUID();
      const publicActivity = publicActivityById.get(evidence.place.activityId);
      if (!publicActivity)
        throw new AuthError(404, '방문 인증 장소 정보를 다시 확인해 주세요.');
      const activity = structuredClone(publicActivity);
      activity.reward = evidence.place.reward;
      // Keep the canonical venue/reference for reopening MY history, while
      // storing no latitude/longitude in the member's account snapshot.
      if (activity.reference?.location) {
        delete activity.reference.location.latitude;
        delete activity.reference.location.longitude;
      }
      const checkIn = {
        id,
        activityId: evidence.place.activityId,
        venueKey: evidence.place.venueKey,
        region: evidence.place.region,
        distanceMeters: evidence.distanceMeters,
        accuracyMeters: evidence.accuracyMeters,
        reward: evidence.place.reward,
        createdAt,
        activity,
      };
      user.checkIns.push(checkIn);
      user.profile.balance =
        (user.profile.balance || 0) + evidence.place.reward;
      user.ledger.unshift({
        id: crypto.randomUUID(),
        amount: evidence.place.reward,
        description: `${evidence.place.title} GPS 방문 인증`,
        created_at: createdAt,
      });
      return checkIn;
    });
  }

  async updateProfile(userId, input) {
    const displayName =
      typeof input.displayName === 'string' ? input.displayName.trim() : '';
    const interests = Array.isArray(input.interests) ? input.interests : [];
    const gender = input.gender;
    if (!displayName || displayName.length > 30)
      throw new AuthError(400, '이름은 1~30자로 입력해 주세요.');
    if (
      interests.length > 8 ||
      !interests.every((item) => typeof item === 'string' && item.length <= 30)
    )
      throw new AuthError(400, '관심 활동은 최대 8개까지 선택해 주세요.');
    if (!['unspecified', 'woman', 'man', 'other'].includes(gender))
      throw new AuthError(400, '성별 선택값을 확인해 주세요.');
    return this.transaction((data) => {
      const user = data.users.find((item) => item.id === userId);
      if (!user) throw new AuthError(401, '다시 로그인해 주세요.');
      user.profile = {
        ...user.profile,
        display_name: displayName,
        interests: [...new Set(interests)],
        gender,
      };
      return user.profile;
    });
  }
}

module.exports = {
  AuthError,
  AuthStore,
  normalizeUsername,
  validatePassword,
};
