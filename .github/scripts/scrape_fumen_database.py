import requests
from bs4 import BeautifulSoup
import json
import time
import re


def scrape_fumen_database():
    """
    爬取 fumen-database.com 的难度列表页面，
    提取所有歌曲的链接
    """
    url = "https://fumen-database.com/difficulty/?const_desc"

    # 设置请求头，模拟浏览器访问
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        print(f"正在访问: {url}")
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        response.encoding = "utf-8"

        # 使用 BeautifulSoup 解析 HTML
        soup = BeautifulSoup(response.text, "html.parser")

        # 查找目标容器
        top_wrapper = soup.find("div", class_="top-wrapper")

        if not top_wrapper:
            print("未找到 top-wrapper")
            return []

        table_song_data_wrapper = top_wrapper.find(
            "div", class_="table_song_data-wrapper"
        )

        if not table_song_data_wrapper:
            print("未找到 table_song_data-wrapper")
            return []

        table_song_data = table_song_data_wrapper.find("div", class_="table_song_data")

        if not table_song_data:
            print("未找到 table_song_data")
            return []

        # 提取所有包含 table_song_name 的链接
        song_links = []
        song_name_divs = table_song_data.find_all(
            "div", class_=lambda x: bool(x and "table_song_name" in x)
        )

        print(f"找到 {len(song_name_divs)} 个歌曲条目")

        for div in song_name_divs:
            a_tag = div.find("a")
            if a_tag and a_tag.get("href"):
                href: str = a_tag.get("href")  # pyright: ignore[reportAssignmentType]
                # 如果是相对路径，转换为完整 URL
                if href and href.startswith("/"):
                    href = f"https://fumen-database.com{href}"

                song_info = {"href": href, "title": a_tag.get_text(strip=True)}
                song_links.append(song_info)

        return song_links

    except requests.exceptions.RequestException as e:
        print(f"请求错误: {e}")
        return []
    except Exception as e:
        print(f"解析错误: {e}")
        return []


def extract_song_id_from_url(url):
    """从 URL 中提取歌曲 ID (xxx-x 部分)"""
    match = re.search(r"/song/([^/]+)/", url)
    if match:
        return match.group(1)
    return None


def parse_script_data(soup):
    """解析页面中的 script nonce 数据"""
    script_tags = soup.find_all("script", {"nonce": True})

    for script in script_tags:
        script_content = script.string
        if script_content and "song_name" in script_content:
            # 尝试提取 JavaScript 对象数据
            try:
                # 查找 const xxx = {...}; 或 var xxx = {...};
                match = re.search(
                    r"(?:const|var|let)\s+(\w+)\s*=\s*\{([^}]+)\};",
                    script_content,
                    re.DOTALL,
                )
                if match:
                    obj_content = match.group(2)

                    # 将 JavaScript 对象格式转换为 JSON 格式
                    # 1. 将单引号替换为双引号（处理转义的单引号）
                    json_content = obj_content

                    # 先处理值中的单引号（转义它们）
                    # 匹配 key: 'value' 模式
                    def replace_quotes(match):
                        key = match.group(1)
                        value = match.group(2)
                        # 转义值中的双引号和反斜杠
                        value = value.replace("\\", "\\\\").replace('"', '\\"')
                        return f'"{key}": "{value}"'

                    # 匹配格式: key: 'value'
                    json_content = re.sub(
                        r"(\w+)\s*:\s*'([^']*)'", replace_quotes, json_content
                    )

                    # 匹配格式: key: "value"（如果已经是双引号）
                    json_content = re.sub(
                        r'(\w+)\s*:\s*"([^"]*)"', r'"\1": "\2"', json_content
                    )

                    # 包装成完整的 JSON 对象
                    json_str = "{" + json_content + "}"

                    # 使用 json.loads 解析
                    data = json.loads(json_str)

                    # 尝试将数字字符串转换为数字
                    for key, value in data.items():
                        if isinstance(value, str):
                            try:
                                if "." in value:
                                    data[key] = float(value)
                                else:
                                    data[key] = int(value)
                            except ValueError:
                                pass  # 保持字符串

                    if data:
                        return data
            except Exception as e:
                print(f"  解析 script 数据失败: {e}")
                import traceback

                traceback.print_exc()
                continue

    return None


def scrape_song_detail(url):
    """
    爬取单个歌曲详情页
    提取 constant, totalNotes 和雷达图数据
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        print(f"  正在爬取: {url}")
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        response.encoding = "utf-8"

        soup = BeautifulSoup(response.text, "html.parser")

        # 提取 song_id
        song_id = extract_song_id_from_url(url)
        if not song_id:
            print("  ✗ 无法从 URL 提取歌曲 ID")
            return None

        # 解析 script nonce 中的数据
        script_data = parse_script_data(soup)
        if not script_data:
            print("  ✗ 未找到 script 数据")
            return None

        # 提取 constant
        constant = None
        top_wrapper = soup.find("div", class_="top-wrapper")
        if top_wrapper:
            const_area = top_wrapper.find("div", class_="const_area")
            if const_area:
                p_tags = const_area.find_all("p")
                for p in p_tags:
                    span = p.find("span", id="score_const_origin")
                    if span:
                        const_text = span.get_text(strip=True)
                        try:
                            constant = float(const_text)
                        except ValueError:
                            print(f"  ✗ 无法解析 constant: {const_text}")
                        break

        # 提取 totalNotes
        total_notes = None
        song_info_div = soup.find("div", class_="song_info")
        if song_info_div:
            song_info_area = song_info_div.find("div", class_="song_info_area")
            if song_info_area:
                divs = song_info_area.find_all("div")
                for div in divs:
                    # 查找包含 title_combo 的 img
                    img = div.find("img", src=lambda x: x and "title_combo" in x)  # pyright: ignore[reportArgumentType]
                    if img:
                        # 找到这个 div 中的 p 标签
                        p_tag = div.find("p")
                        if p_tag:
                            notes_text = p_tag.get_text(strip=True)
                            try:
                                total_notes = int(notes_text)
                            except ValueError:
                                print(f"  ✗ 无法解析 totalNotes: {notes_text}")
                        break

        # 构建结果
        result = {
            "title": script_data.get("song_name", "")
            .replace(" （おに裏）", "(裏)")
            .replace(" （おに）", "")
            .strip(),
            "constant": constant,
            "totalNotes": total_notes,
            "composite": script_data.get("radar_compound", None),
            "avgDensity": script_data.get("radar_density_ave", None),
            "instDensity": script_data.get("radar_density_inst", None),
            "separation": script_data.get("radar_division", None),
            "bpmChange": script_data.get("radar_change_bpm", None),
            "hsChange": script_data.get("radar_change_hs", None),
        }

        print(f"  ✓ {result['title']} - Constant: {constant}, Notes: {total_notes}")
        return song_id, result

    except requests.exceptions.RequestException as e:
        print(f"  ✗ 请求错误: {e}")
        return None
    except Exception as e:
        print(f"  ✗ 解析错误: {e}")
        import traceback

        traceback.print_exc()
        return None


def save_to_json(data, filename="song_data.json"):
    """将数据保存为 JSON 文件"""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n数据已保存到 {filename}")


def convert_to_new_format(old_data):
    """
    将旧格式数据转换为新格式
    旧格式: {"id-difficulty": {song_data}}
    新格式: [{id, title, level: {4: {...}, 5: {...}}}]
    """
    songs_map = {}

    for key, song_data in old_data.items():
        # 解析 key: "id-difficulty"
        last_dash_index = key.rfind("-")
        if last_dash_index == -1:
            print(f"警告: 跳过格式不正确的键: {key}")
            continue

        song_id = key[:last_dash_index]
        difficulty = key[last_dash_index + 1 :]

        # 验证 difficulty 是 4 或 5
        if difficulty not in ["4", "5"]:
            print(f"警告: 跳过不支持的难度: {key} (difficulty: {difficulty})")
            continue

        # 提取 title 和其他数据
        title = (
            song_data.pop("title", "")
            .replace(" （おに裏）", "")
            .replace(" （おに）", "")
            .strip()
        )

        # 如果这个 id 还没有记录，创建新条目
        if song_id not in songs_map:
            songs_map[song_id] = {
                "id": int(song_id),
                "title": title,
                "level": {},
            }

        # 添加难度数据
        songs_map[song_id]["level"][difficulty] = song_data

    # 转换为数组并按 id 排序
    new_data = sorted(songs_map.values(), key=lambda x: x["id"])

    return new_data


def scrape_all_songs():
    """爬取所有歌曲"""
    print("开始爬取 fumen-database.com...")
    print("=" * 50)

    # 第一步：获取所有歌曲链接
    song_links = scrape_fumen_database()

    print("=" * 50)
    print(f"\n总共找到 {len(song_links)} 个歌曲")

    if not song_links:
        print("未找到任何歌曲链接")
        return None

    # 第二步：爬取每个歌曲的详细信息
    print("\n开始爬取歌曲详情...")
    print("=" * 50)

    all_songs_data = {}
    success_count = 0
    fail_count = 0
    fails = []
    max_retries = 5

    for i, song_link in enumerate(song_links, 1):
        print(f"\n[{i}/{len(song_links)}] {song_link['title']}")

        result = None
        retry_count = 0

        # 重试机制：最多尝试5次
        while retry_count < max_retries and result is None:
            if retry_count > 0:
                print(f"  → 第 {retry_count + 1} 次尝试...")
                time.sleep(1)  # 重试前等待1秒

            result = scrape_song_detail(song_link["href"])
            retry_count += 1

        if result:
            song_id, song_data = result
            all_songs_data[song_id] = song_data
            success_count += 1
        else:
            fail_count += 1
            fails.append(song_link["title"])
            print(f"  ✗ 爬取失败（已重试 {max_retries} 次）")

        # 添加延迟，避免请求过快
        if i < len(song_links):
            pass
            # time.sleep(1)  # 每个请求间隔1秒

    print("\n" + "=" * 50)
    print("爬取完成！")
    print(f"成功: {success_count} 个")
    print(f"失败: {fail_count} 个")

    if fails:
        print("\n以下歌曲爬取失败：")
        for fail in fails:
            print(f"  - {fail}")

    # 转换为新格式
    print("\n" + "=" * 50)
    print("转换为新格式...")
    new_format_data = convert_to_new_format(all_songs_data)
    print(f"✓ 转换完成: {len(new_format_data)} 首歌曲")

    return new_format_data


def test_single_page(url):
    """测试单个页面的爬取"""
    print(f"测试单个页面: {url}")
    print("=" * 50)

    result = scrape_song_detail(url)

    if result:
        song_id, song_data = result
        print("\n" + "=" * 50)
        print("爬取成功！")
        print("\n歌曲 ID:", song_id)
        print("\n歌曲数据 (旧格式):")
        print(json.dumps({song_id: song_data}, ensure_ascii=False, indent=2))

        # 转换为新格式
        old_format = {song_id: song_data}
        new_format = convert_to_new_format(old_format)

        print("\n歌曲数据 (新格式):")
        print(json.dumps(new_format, ensure_ascii=False, indent=2))

        return new_format
    else:
        print("\n" + "=" * 50)
        print("爬取失败！")
        return None


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # test_url = sys.argv[1]
        test_url = r"https://fumen-database.com/song/714-4/"
        result = test_single_page(test_url)
        if result:
            # 保存测试结果
            save_to_json(result, "test_song_data.json")
    else:
        # 否则爬取所有歌曲
        all_songs_data = scrape_all_songs()
        if all_songs_data:
            # 保存到 JSON 文件 (新格式是数组)
            save_to_json(all_songs_data, "public/songs.json")
