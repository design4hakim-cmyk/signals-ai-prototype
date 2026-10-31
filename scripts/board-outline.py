# Usage: python3 -I scripts/board-outline.py board.html > board.outline.txt
"""Compress a canvas board's HTML into a readable outline.
Keeps text, plus a few layout/style properties per element. Untrusted input: only parsed, never executed."""
import re
import sys
from html.parser import HTMLParser

KEEP = ['width', 'height', 'background', 'border', 'border-radius', 'color', 'font-size',
        'font-weight', 'box-shadow', 'opacity', 'gap', 'padding']
SKIP_TAGS = {'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'style', 'script', 'link', 'head', 'meta', 'title'}


def short_style(s):
    out = []
    for decl in s.split(';'):
        if ':' not in decl:
            continue
        k, v = decl.split(':', 1)
        k, v = k.strip(), v.strip()
        if k in KEEP and v not in ('0', '0px', 'none', 'transparent'):
            out.append(f'{k}:{v}')
    return ' '.join(out)


class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.skip = 0
        self.lines = []

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            if tag not in ('link', 'meta', 'path', 'circle', 'rect', 'line', 'polyline'):
                self.skip += 1
            if tag == 'svg' and not self.skip - 1:
                self.lines.append('  ' * self.depth + '[icon]')
            return
        if self.skip:
            return
        a = dict(attrs)
        bits = [tag]
        for k in ('role', 'aria-label', 'aria-selected', 'aria-checked', 'aria-pressed', 'disabled', 'title', 'placeholder'):
            if k in a:
                bits.append(f'{k}="{a[k]}"' if a[k] is not None else k)
        st = short_style(a.get('style', '') or '')
        if st:
            bits.append('{' + st + '}')
        self.lines.append('  ' * self.depth + ' '.join(bits))
        if tag not in ('input', 'br', 'img', 'hr'):
            self.depth += 1

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS:
            if tag not in ('link', 'meta', 'path', 'circle', 'rect', 'line', 'polyline'):
                self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        if tag not in ('input', 'br', 'img', 'hr'):
            self.depth = max(0, self.depth - 1)

    def handle_data(self, data):
        if self.skip:
            return
        t = data.strip()
        if t:
            self.lines.append('  ' * self.depth + '"' + t + '"')


html = open(sys.argv[1]).read()
html = re.sub(r'<helmet>.*?</helmet>', '', html, flags=re.S)
p = P()
p.feed(html)
# collapse pure wrapper lines (div with no info) to save space
out = [l for l in p.lines if l.strip() not in ('div', 'span')]
print('\n'.join(out))
