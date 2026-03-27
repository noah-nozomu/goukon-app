# 💑 合コンマッチングアプリ

合コン向けのリアルタイムマッチングWebアプリです。  
実際の合コンで運用し、その場でプロフィールを作成してマッチングする体験を実現しました。

---

## 🔗 リンク

| | URL |
|---|---|
| 本番 | https://goukon-app.vercel.app |

---

## 📱 主な機能

- **プロフィール作成**：写真・呼び名を登録してその場で参加
- **マッチング機能**：気になる相手を選んで相互マッチングを判定
- **チャット機能**：マッチング成立後にリアルタイムでメッセージ交換
- **通知機能**：マッチング成立時にリアルタイム通知

---

## 🛠 使用技術

| 分類 | 技術 |
|---|---|
| フロントエンド | Next.js / TypeScript |
| バックエンド | Next.js API Routes |
| データベース | Firebase Firestore |
| 認証・ストレージ | Firebase |
| ホスティング | Vercel |

---

## 💡 工夫した点

- **リアルタイム通信**にFirebase Firestoreのリスナーを活用し、マッチング・チャットを即時反映
- スマートフォンでの利用を前提に、**モバイルファーストなUI**を設計
- 合コン当日に初めて使うユーザーでも迷わないよう、**シンプルな導線**を意識

---

## 📸 スクリーンショット

<!-- スクリーンショットをここに追加 -->!
![matching](https://github.com/user-attachments/assets/068df33b-ffcc-4005-98b1-eed88174a6d1)

![参加画面](https://github.com/user-attachments/assets/8abbdf8a-37f0-4669-805e-316168f1f012)
![プロフィール画面](https://github.com/user-attachments/assets/a2d37f5f-0f66-4421-8be6-4c713417889c)
![参加者画面](https://github.com/user-attachments/assets/d6d51c88-df8d-437f-9169-ac6f6cca652d)
![マッチング画面](https://github.com/user-attachments/assets/7accc567-96ad-4525-a120-2216384d3eb4)
![チャット画面](https://github.com/user-attachments/assets/ae953ea3-17a5-445b-afa0-cab27f505ea1)


## ⚙️ ローカル起動方法

```bash
git clone https://github.com/noah-nozomu/goukon-app
cd goukon-app
npm install

# .env.localファイルを作成してFirebaseの設定を追加
npm run dev
```
