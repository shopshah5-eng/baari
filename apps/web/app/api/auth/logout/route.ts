import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('baari_session');
  response.cookies.delete('baari_role');
  return response;
}

