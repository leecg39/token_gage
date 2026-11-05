"""herdr-skillshare 레이아웃의 하단 status 블록을 [token-gage | workspace-status] 한 줄로 바꾼다.
이미 바뀌어 있으면 아무것도 하지 않는다."""
import json, sys, os

path = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/.config/herdr-app/layouts/herdr-skillshare.json")
STATUS_PX = 400

def status_row(old):
    return {
        "id": "status-row", "type": "row", "size": old.get("size", {"px": 28}), "resizable": False,
        "children": [
            {"id": "token-gage", "type": "block", "size": {"weight": 1}, "content": {"mod": "token-gage"}},
            {**old, "size": {"px": STATUS_PX}},
        ],
    }

def rewrite(node):
    if node.get("id") == "status-row":
        return node, False
    children = node.get("children")
    if not children:
        return node, False
    changed = False
    out = []
    for child in children:
        if child.get("id") == "status" and child.get("content", {}).get("mod") == "workspace-status":
            out.append(status_row(child)); changed = True
        else:
            new_child, c = rewrite(child); out.append(new_child); changed = changed or c
    return {**node, "children": out}, changed

with open(path, encoding="utf-8") as f:
    layout = json.load(f)
new_layout, changed = rewrite(layout)
if not changed:
    print("변경 없음 (이미 연결됐거나 status 블록이 없음)")
    sys.exit(0)
tmp = path + ".tmp"
with open(tmp, "w", encoding="utf-8") as f:
    json.dump(new_layout, f, ensure_ascii=False, indent=2); f.write("\n")
os.replace(tmp, path)
print("레이아웃 연결 완료:", path)
