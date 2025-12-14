import json
import os
import requests
from pathlib import Path


def process_songs_json(songs_cn_data, repo_root):
    """
    处理 songs.json 文件，添加 title_cn 和 is_cn 字段
    """
    songs_json_path = repo_root / "public" / "songs.json"

    if not songs_json_path.exists():
        print(f"警告: {songs_json_path} 不存在，跳过处理")
        return

    try:
        # 读取 songs.json
        print(f"正在读取 {songs_json_path}...")
        with open(songs_json_path, "r", encoding="utf-8") as f:
            songs_data = json.load(f)

        # 为所有歌曲添加初始字段
        for song in songs_data:
            song["title_cn"] = song.get("title", "")
            song["is_cn"] = False

        # 创建 cn songs 的 id 映射
        cn_songs_map = {}
        for cn_song in songs_cn_data:
            song_id = cn_song.get("id")
            song_name = cn_song.get("song_name", "")
            if song_id:
                cn_songs_map[song_id] = song_name

        # 更新匹配的歌曲
        updated_count = 0
        for song in songs_data:
            song_id = song.get("id")
            if song_id in cn_songs_map:
                song["is_cn"] = True
                song["title_cn"] = cn_songs_map[song_id]
                updated_count += 1

        # 保存修改后的 songs.json
        with open(songs_json_path, "w", encoding="utf-8") as f:
            json.dump(songs_data, f, indent=2, ensure_ascii=False)

        print(f"✓ 成功更新 {updated_count} 首歌曲的中文信息到 {songs_json_path}")

    except Exception as e:
        print(f"✗ 处理 songs.json 时发生错误: {e}")
        raise


def fetch_and_save_songs():
    """
    从API获取歌曲数据并保存到public/songs_cn.json
    """
    # 从环境变量读取敏感信息
    api_url = os.getenv("TAIKO_API_URL")
    api_token = os.getenv("TAIKO_API_TOKEN")

    if not api_url:
        raise ValueError("环境变量 TAIKO_API_URL 未设置")
    if not api_token:
        raise ValueError("环境变量 TAIKO_API_TOKEN 未设置")

    try:
        # 发送GET请求
        response = requests.post(
            api_url,
            headers={
                "Authorization": api_token,
                "Content-Type": "application/json",
            },
            json={"page": 1, "pageSize": 2000},
        )
        response.raise_for_status()  # 如果状态码不是 2xx 则抛出异常

        result = response.json()
        songs_data = result["data"]["list"]

        # 确定保存路径
        script_dir = Path(__file__).parent
        repo_root = script_dir.parent.parent

        # 处理 songs.json 文件
        process_songs_json(songs_data, repo_root)

    except requests.exceptions.RequestException as e:
        print(f"✗ 请求失败: {e}")
        raise
    except json.JSONDecodeError as e:
        print(f"✗ JSON解析失败: {e}")
        raise
    except Exception as e:
        print(f"✗ 发生错误: {e}")
        raise


if __name__ == "__main__":
    fetch_and_save_songs()
