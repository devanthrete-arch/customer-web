const IAM_URL = import.meta.env.VITE_IAM_URL || '';
const IAM_KEY = import.meta.env.VITE_IAM_API_KEY || '';
const APP_ID = import.meta.env.VITE_IAM_CUSTOMER_DOMAIN_APPLICATION_ID || '';

export function iamConfigured(): boolean {
  return Boolean(IAM_URL && IAM_KEY && APP_ID);
}

async function iam<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${IAM_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': IAM_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    message?: string | string[];
    otpId?: string;
    otp?: string;
    tokens?: { accessToken?: string };
    accessToken?: string;
  };
  if (!res.ok) {
    const msg = Array.isArray(json.message)
      ? json.message.join(', ')
      : json.message || `IAM ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

export async function generateOtp(mobile: string): Promise<{ otpId: string; otp?: string }> {
  return iam('/api/v1/otp/generate', {
    countryCode: '+91',
    mobile,
    identifierType: 'mobile',
    purpose: 'login',
    domainApplicationId: APP_ID,
  });
}

export async function resendOtp(otpId: string): Promise<{ otpId: string; otp?: string }> {
  return iam('/api/v1/otp/resend', {
    otpId,
    domainApplicationId: APP_ID,
  });
}

export async function loginOtp(otpId: string, otp: string): Promise<string> {
  const json = await iam<{
    tokens?: { accessToken?: string };
    accessToken?: string;
  }>('/api/v1/auth/login/otp', {
    otpId,
    otp,
    domainApplicationId: APP_ID,
  });
  const token = json.tokens?.accessToken ?? json.accessToken;
  if (!token) throw new Error('IAM did not return an access token');
  return token;
}

export async function registerCustomer(
  userName: string,
  mobile: string,
): Promise<void> {
  await iam('/api/v1/auth/register', {
    userName,
    countryCode: '+91',
    mobile,
    domainApplicationId: APP_ID,
  });
}
