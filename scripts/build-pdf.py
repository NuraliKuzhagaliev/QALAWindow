from pathlib import Path
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
sys.path.insert(0,'D:/projects/QALAWindow/.cache/python')
import pypdfium2 as pdfium
out=Path('submission/presentation.pdf')
c=canvas.Canvas(str(out),pagesize=(960,540))
c.setTitle('QALA Window - Astana, within the time you have')
c.setAuthor('QALA Window - AI-authored implementation')
for image in sorted(Path('submission/slides').glob('slide-*.png')):
 c.drawImage(ImageReader(str(image)),0,0,width=960,height=540)
 c.showPage()
c.save()
doc=pdfium.PdfDocument(str(out))
render=Path('.tmp/presentation/pdf-render');render.mkdir(exist_ok=True)
for i,page in enumerate(doc):page.render(scale=1.3).to_pil().save(render/f'page-{i+1:02}.png')
print(f'Presentation PDF created and rendered: {len(doc)} pages')
