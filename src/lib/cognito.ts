// cognito.ts
// Thin wrapper around amazon-cognito-identity-js for donor accounts.
// Deliberately NOT the full AWS Amplify Auth framework -- this project
// doesn't use Amplify Auth elsewhere, so this keeps the dependency
// footprint minimal and matches how everything else here is built
// (direct SDK calls, not a heavier framework).
//
// Tokens are persisted to localStorage (amazon-cognito-identity-js does
// this automatically via CognitoUserPool's built-in storage) so a
// session survives a page refresh -- standard, well-established pattern
// for Cognito User Pool SPAs.

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  ICognitoUserPoolData,
} from 'amazon-cognito-identity-js';

const poolData: ICognitoUserPoolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID as string,
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID as string,
};

export const userPool = new CognitoUserPool(poolData);

export function signUp(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const attributeList = [new CognitoUserAttribute({ Name: 'email', Value: email })];
    userPool.signUp(email, password, attributeList, [], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmRegistration(code, true, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.resendConfirmationCode((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function signIn(email: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session.getIdToken().getJwtToken()),
      onFailure: (err) => reject(err),
    });
  });
}

export function signOut(): void {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
}

/**
 * Returns a valid, non-expired ID token for the current session, or null
 * if nobody's logged in. Automatically refreshes an expired token using
 * the stored refresh token -- callers don't need to think about
 * expiration themselves, just call this before every authenticated API
 * request.
 */
export function getIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const user = userPool.getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: { isValid: () => boolean; getIdToken: () => { getJwtToken: () => string } } | null) => {
      if (err || !session || !session.isValid()) return resolve(null);
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = userPool.getCurrentUser();
    if (!user) return reject(new Error('Not logged in'));
    user.getSession((sessErr: Error | null) => {
      if (sessErr) return reject(sessErr);
      user.changePassword(oldPassword, newPassword, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}
