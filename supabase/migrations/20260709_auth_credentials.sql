-- ログイン用の認証情報テーブル。
-- 1ロール(quest / asahikawa-gas)に対して複数アカウントを登録できる設計。
-- asahikawa-gas ロールは is_admin=true の管理者1名が、他のアカウントの作成/編集/削除を行う
-- （管理者を含めアカウント数の上限は3。上限はアプリ側 ASAHIKAWA_GAS_MAX_ACCOUNTS で判定）。
create extension if not exists pgcrypto;

create table if not exists auth_users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('quest', 'asahikawa-gas')),
  email text not null unique,
  name text,
  is_admin boolean not null default false,
  password_hash text not null,
  reset_token_hash text,
  reset_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- サービスロールキー経由でのみアクセスする想定（RLSで一般クライアントからのアクセスを遮断）
alter table auth_users enable row level security;

-- 1ロールにつき管理者(is_admin=true)は1名まで
create unique index if not exists auth_users_one_admin_per_role
  on auth_users (role)
  where is_admin;
