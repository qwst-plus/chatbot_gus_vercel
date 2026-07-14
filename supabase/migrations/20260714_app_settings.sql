-- クウェスト社内向け設定画面（API設定・スマートルーティング設定・プロンプト設定など）が
-- 使う汎用キーバリュー設定テーブル。value は必要に応じてアプリ側で暗号化して保存する。
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- サービスロールキー経由でのみアクセスする想定（RLSで一般クライアントからのアクセスを遮断）
alter table app_settings enable row level security;
