#!/usr/bin/env python3
"""
生成 Canyon Courier 的 2D sprite 资源（纯标准库，无需 PIL）。

用法：  python3 tools/make_sprites.py
输出：  cocos-project/assets/resources/sprites/*.png

所有图形以 3 倍超采样绘制后降采样，得到平滑边缘。
"""
import math
import os
import struct
import zlib

SS = 3  # 超采样倍数
OUT = os.path.join(os.path.dirname(__file__), '..', 'cocos-project',
                   'assets', 'resources', 'sprites')


class Canvas:
    """RGBA 画布，坐标以最终尺寸为准，内部按 SS 倍放大绘制。"""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.W, self.H = w * SS, h * SS
        self.buf = bytearray(self.W * self.H * 4)

    # ---------- 基础 ----------
    def _blend(self, x, y, r, g, b, a):
        if a <= 0 or x < 0 or y < 0 or x >= self.W or y >= self.H:
            return
        i = (y * self.W + x) * 4
        buf = self.buf
        da = buf[i + 3] / 255.0
        sa = a / 255.0
        oa = sa + da * (1 - sa)
        if oa <= 0:
            return
        for k, sc in enumerate((r, g, b)):
            dc = buf[i + k] / 255.0
            buf[i + k] = int(round((sc / 255.0 * sa + dc * da * (1 - sa)) / oa * 255))
        buf[i + 3] = int(round(oa * 255))

    def rect(self, x, y, w, h, color, radius=0):
        r, g, b, a = color
        x0, y0 = int(x * SS), int(y * SS)
        x1, y1 = int((x + w) * SS), int((y + h) * SS)
        rad = radius * SS
        for py in range(y0, y1):
            for px in range(x0, x1):
                if rad > 0:
                    cx = min(max(px + .5, x0 + rad), x1 - rad)
                    cy = min(max(py + .5, y0 + rad), y1 - rad)
                    if math.hypot(px + .5 - cx, py + .5 - cy) > rad:
                        continue
                self._blend(px, py, r, g, b, a)

    def circle(self, cx, cy, radius, color):
        r, g, b, a = color
        CX, CY, R = cx * SS, cy * SS, radius * SS
        for py in range(max(0, int(CY - R)), min(self.H, int(CY + R) + 1)):
            for px in range(max(0, int(CX - R)), min(self.W, int(CX + R) + 1)):
                if math.hypot(px + .5 - CX, py + .5 - CY) <= R:
                    self._blend(px, py, r, g, b, a)

    def ring(self, cx, cy, radius, thickness, color):
        r, g, b, a = color
        CX, CY, R, T = cx * SS, cy * SS, radius * SS, thickness * SS
        for py in range(max(0, int(CY - R - T)), min(self.H, int(CY + R + T) + 1)):
            for px in range(max(0, int(CX - R - T)), min(self.W, int(CX + R + T) + 1)):
                d = math.hypot(px + .5 - CX, py + .5 - CY)
                if R - T / 2 <= d <= R + T / 2:
                    self._blend(px, py, r, g, b, a)

    def poly(self, pts, color):
        r, g, b, a = color
        P = [(x * SS, y * SS) for x, y in pts]
        ys = [p[1] for p in P]
        for py in range(max(0, int(min(ys))), min(self.H, int(max(ys)) + 1)):
            yc = py + .5
            xs = []
            for i in range(len(P)):
                x1, y1 = P[i]
                x2, y2 = P[(i + 1) % len(P)]
                if (y1 <= yc < y2) or (y2 <= yc < y1):
                    xs.append(x1 + (yc - y1) / (y2 - y1) * (x2 - x1))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for px in range(int(xs[i]), int(xs[i + 1]) + 1):
                    self._blend(px, py, r, g, b, a)

    # ---------- 输出 ----------
    def downsample(self):
        out = bytearray(self.w * self.h * 4)
        n = SS * SS
        for y in range(self.h):
            for x in range(self.w):
                tr = tg = tb = ta = 0
                for sy in range(SS):
                    for sx in range(SS):
                        i = ((y * SS + sy) * self.W + (x * SS + sx)) * 4
                        al = self.buf[i + 3]
                        tr += self.buf[i] * al
                        tg += self.buf[i + 1] * al
                        tb += self.buf[i + 2] * al
                        ta += al
                o = (y * self.w + x) * 4
                if ta > 0:
                    out[o] = min(255, tr // ta)
                    out[o + 1] = min(255, tg // ta)
                    out[o + 2] = min(255, tb // ta)
                out[o + 3] = ta // n
        return bytes(out)

    def save(self, path):
        raw = self.downsample()
        rows = b''.join(b'\x00' + raw[y * self.w * 4:(y + 1) * self.w * 4]
                        for y in range(self.h))

        def chunk(tag, data):
            c = struct.pack('>I', len(data)) + tag + data
            return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

        png = (b'\x89PNG\r\n\x1a\n'
               + chunk(b'IHDR', struct.pack('>IIBBBBB', self.w, self.h, 8, 6, 0, 0, 0))
               + chunk(b'IDAT', zlib.compress(rows, 9))
               + chunk(b'IEND', b''))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(png)
        print('  %-22s %dx%d  %5d B' % (os.path.basename(path), self.w, self.h, len(png)))


# ---------------- 调色板 ----------------
SHADOW = (30, 14, 8, 90)
DARK = (44, 36, 33, 255)
HERO_BODY = (240, 163, 14, 255)
HERO_LIGHT = (255, 197, 42, 255)
HERO_GLASS = (131, 215, 214, 255)
BLADE = (255, 189, 22, 255)
CRYSTAL = (36, 216, 255, 255)
CRYSTAL_HI = (168, 244, 255, 255)
CRYSTAL_LO = (8, 124, 186, 255)
GOLD = (244, 184, 38, 255)
GOLD_HI = (255, 226, 130, 255)
PURPLE = (140, 57, 221, 255)
PURPLE_HI = (196, 122, 255, 255)
LAVA = (255, 59, 11, 255)
LAVA_HI = (255, 168, 40, 255)
GROUND = (142, 82, 55, 255)
GROUND_HI = (163, 99, 68, 255)
ROCK = (169, 95, 63, 255)
ROCK_HI = (192, 113, 72, 255)
ROCK_LO = (129, 65, 47, 255)
WHITE = (255, 255, 255, 255)


def hero():
    """主角：俯视角推土机快递员，车头朝上(-y)。"""
    c = Canvas(96, 112)
    c.rect(16, 26, 66, 84, (30, 14, 8, 52), radius=12)  # 贴地淡影
    c.rect(10, 6, 76, 18, DARK, radius=6)              # 前铲阴影
    c.rect(8, 2, 80, 16, BLADE, radius=5)              # 前铲
    for i in range(6):                                  # 铲齿
        c.rect(12 + i * 13, 0, 8, 7, (255, 207, 54, 255), radius=2)
    c.rect(12, 24, 18, 72, DARK, radius=7)             # 左履带
    c.rect(66, 24, 18, 72, DARK, radius=7)             # 右履带
    for i in range(7):                                  # 履带纹
        c.rect(14, 30 + i * 10, 14, 4, (86, 74, 68, 255), radius=2)
        c.rect(68, 30 + i * 10, 14, 4, (86, 74, 68, 255), radius=2)
    c.rect(26, 22, 44, 74, HERO_BODY, radius=9)        # 车身
    c.rect(30, 26, 36, 30, HERO_LIGHT, radius=7)       # 车头高光
    c.rect(33, 60, 30, 26, HERO_GLASS, radius=6)       # 驾驶舱
    c.rect(36, 63, 24, 9, (198, 240, 240, 255), radius=4)
    c.rect(28, 90, 40, 6, (198, 122, 20, 255), radius=3)
    c.save(os.path.join(OUT, 'hero.png'))


def crystal(size, name, glow=True):
    """资源水晶（八面体感）。"""
    c = Canvas(size, size)
    h = size / 2
    if glow:
        c.circle(h, h * 1.06, h * .92, (36, 216, 255, 46))
        c.circle(h, h * 1.06, h * .68, (36, 216, 255, 60))
    c.poly([(h, size * .10), (size * .90, h), (h, size * .90), (size * .10, h)], CRYSTAL)
    c.poly([(h, size * .10), (size * .90, h), (h, h)], CRYSTAL_HI)      # 右上亮面
    c.poly([(h, h), (h, size * .90), (size * .10, h)], CRYSTAL_LO)      # 左下暗面
    c.poly([(h, size * .10), (h, h), (size * .10, h)], (96, 232, 255, 255))
    c.save(os.path.join(OUT, name))


def resource_pile():
    """资源堆：三颗水晶簇。"""
    c = Canvas(80, 80)
    c.circle(40, 64, 22, (30, 14, 8, 46))            # 贴地淡影
    for cx, cy, s, col in ((26, 48, 19, CRYSTAL_LO), (54, 46, 21, CRYSTAL),
                           (40, 30, 24, CRYSTAL)):
        c.poly([(cx, cy - s), (cx + s * .8, cy), (cx, cy + s), (cx - s * .8, cy)], col)
        c.poly([(cx, cy - s), (cx + s * .8, cy), (cx, cy)], CRYSTAL_HI)
    c.save(os.path.join(OUT, 'resource-pile.png'))


def delivery_pad():
    """投递区：金色圆台。"""
    c = Canvas(256, 256)
    c.circle(128, 128, 120, (120, 70, 20, 70))
    c.circle(128, 128, 112, GOLD)
    c.circle(128, 128, 96, (255, 205, 74, 255))
    c.ring(128, 128, 104, 10, GOLD_HI)
    c.ring(128, 128, 66, 7, (255, 236, 168, 200))
    for i in range(12):                                  # 放射刻度
        a = i * math.pi / 6
        c.circle(128 + math.cos(a) * 86, 128 + math.sin(a) * 86, 7, GOLD_HI)
    c.poly([(128, 74), (154, 122), (128, 106), (102, 122)], (255, 250, 226, 235))
    c.poly([(128, 182), (154, 134), (128, 150), (102, 134)], (255, 250, 226, 235))
    c.save(os.path.join(OUT, 'delivery-pad.png'))


def gate():
    """倍率门：紫色门框（门柱 + 横梁）。"""
    c = Canvas(320, 128)
    c.rect(0, 44, 320, 34, (92, 35, 149, 255), radius=12)     # 横梁底
    c.rect(0, 40, 320, 30, PURPLE, radius=12)                 # 横梁
    c.rect(6, 45, 308, 9, PURPLE_HI, radius=5)                # 横梁高光
    for x in (2, 286):                                        # 门柱
        c.rect(x, 18, 32, 104, (92, 35, 149, 255), radius=9)
        c.rect(x + 2, 14, 28, 100, PURPLE, radius=8)
        c.rect(x + 7, 20, 8, 88, PURPLE_HI, radius=4)
    c.rect(104, 76, 112, 40, (58, 20, 96, 210), radius=10)    # 数值底板
    c.save(os.path.join(OUT, 'gate.png'))


def hazard():
    """危险区：岩浆带。"""
    c = Canvas(256, 128)
    c.rect(0, 0, 256, 128, (122, 26, 6, 255), radius=10)
    c.rect(4, 5, 248, 118, LAVA, radius=9)
    for cx, cy, r in ((44, 40, 20), (120, 74, 26), (200, 36, 22),
                      (168, 100, 16), (72, 98, 14), (232, 84, 12)):
        c.circle(cx, cy, r, LAVA_HI)
        c.circle(cx, cy, r * .5, (255, 226, 130, 255))
    c.save(os.path.join(OUT, 'hazard.png'))


def ground_tile():
    """地面砖（可平铺）。"""
    c = Canvas(128, 128)
    c.rect(0, 0, 128, 128, GROUND)
    for x, y, w, h in ((10, 14, 40, 26), (66, 30, 44, 22), (24, 66, 52, 24),
                       (86, 84, 34, 30), (4, 100, 40, 20)):
        c.rect(x, y, w, h, GROUND_HI, radius=8)
    c.save(os.path.join(OUT, 'ground.png'))


def rock():
    """峡谷岩块。"""
    c = Canvas(112, 112)
    c.circle(58, 70, 42, (30, 14, 8, 40))            # 贴地淡影
    c.poly([(56, 8), (98, 34), (100, 82), (58, 104), (16, 80), (12, 32)], ROCK)
    c.poly([(56, 8), (98, 34), (72, 56), (40, 44)], ROCK_HI)
    c.poly([(16, 80), (58, 104), (100, 82), (66, 74)], ROCK_LO)
    c.save(os.path.join(OUT, 'rock.png'))


def joystick():
    c = Canvas(160, 160)
    c.circle(80, 80, 74, (18, 12, 10, 96))
    c.ring(80, 80, 66, 8, (255, 255, 255, 120))
    c.save(os.path.join(OUT, 'joy-base.png'))
    k = Canvas(88, 88)
    k.circle(44, 44, 40, (255, 255, 255, 78))
    k.circle(44, 44, 31, (255, 236, 190, 225))
    k.save(os.path.join(OUT, 'joy-knob.png'))


def panel():
    """通用白色圆角面板（用颜色叠加成各种 UI 底板）。"""
    c = Canvas(64, 64)
    c.rect(0, 0, 64, 64, WHITE, radius=16)
    c.save(os.path.join(OUT, 'panel.png'))


if __name__ == '__main__':
    print('生成 sprite 到 %s' % os.path.normpath(OUT))
    hero()
    crystal(48, 'crystal.png')
    crystal(28, 'carry-item.png', glow=False)
    resource_pile()
    delivery_pad()
    gate()
    hazard()
    ground_tile()
    rock()
    joystick()
    panel()
    print('完成。')
