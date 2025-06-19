/**
 * 日本時間（JST）用のユーティリティ関数
 */

// タイムゾーンを日本時間に設定
process.env.TZ = 'Asia/Tokyo';

export class JSTDate {
  /**
   * 現在の日本時間を取得
   */
  static now(): Date {
    return new Date();
  }

  /**
   * 日本時間の文字列を取得
   */
  static nowString(): string {
    return new Date().toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * 日付を日本時間の文字列に変換
   */
  static toJSTString(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * 短い形式の日本時間文字列
   */
  static toJSTShortString(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 時刻のみの日本時間文字列
   */
  static toJSTTimeString(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleTimeString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * ISO形式の日本時間文字列（タイムゾーン付き）
   */
  static toJSTISOString(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    // JSTはUTC+9なので、+09:00を付加
    const jstTime = new Date(d.getTime() + (9 * 60 * 60 * 1000));
    return jstTime.toISOString().replace('Z', '+09:00');
  }

  /**
   * 稼働時間を日本語で表示
   */
  static formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}日 ${hours % 24}時間 ${minutes % 60}分`;
    if (hours > 0) return `${hours}時間 ${minutes % 60}分`;
    if (minutes > 0) return `${minutes}分 ${seconds % 60}秒`;
    return `${seconds}秒`;
  }

  /**
   * 日本の年月日文字列
   */
  static toJapaneseDateString(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}年${month}月${day}日`;
  }
}

// グローバル設定
export function setupTimezone(): void {
  // 環境変数でタイムゾーンを設定
  process.env.TZ = 'Asia/Tokyo';
  
  // Node.jsの内部タイムゾーンも更新
  if (process.env.TZ) {
    try {
      // プロセスのタイムゾーンを更新
      const originalDateNow = Date.now;
      Date.now = () => originalDateNow.call(Date);
    } catch (error) {
      console.warn('タイムゾーン設定の更新に失敗:', error);
    }
  }

  console.log(`🕐 タイムゾーン設定: ${process.env.TZ}`);
  console.log(`🕐 現在時刻: ${JSTDate.nowString()}`);
}