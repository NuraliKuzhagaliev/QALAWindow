from pathlib import Path
from PIL import Image,ImageDraw
p=Path('assets');p.mkdir(exist_ok=True)
im=Image.new('RGBA',(256,256),(0,0,0,0));d=ImageDraw.Draw(im)
d.rounded_rectangle((4,4,252,252),radius=50,fill='#123F36')
d.polygon([(62,65),(119,53),(119,193),(62,203)],fill='#D5EE8A')
d.polygon([(135,73),(191,62),(191,177),(135,188)],fill='#F6F3EC')
im.save(p/'qala.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
im.save(p/'qala.png')
(p/'qala.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect x="4" y="4" width="248" height="248" rx="50" fill="#123F36"/><path d="M62 65L119 53V193L62 203Z" fill="#D5EE8A"/><path d="M135 73L191 62V177L135 188Z" fill="#F6F3EC"/></svg>')
