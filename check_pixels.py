import cv2
import numpy as np

img = cv2.imread('D:/Proyectos/fisiogestion/public/referencia.jpeg')
height, width, _ = img.shape
print(f"Image size Image: {width}x{height}")

# Find top, bottom, left, right of the figure by thresholding non-white
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
_, thresh = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)

coords = cv2.findNonZero(thresh)
ys = [c[0][1] for c in coords]
xs = [c[0][0] for c in coords]

print(f"Top: {min(ys)/height:.3f}, Bottom: {max(ys)/height:.3f}")
print(f"Left: {min(xs)/width:.3f}, Right: {max(xs)/width:.3f}")

# Find the specific Y coordinates for the hands
# Filter points for the left-most figure (Anterior hand, Right side)
left_figure_y = [c[0][1] for c in coords if c[0][0] < int(width*0.2)]
print(f"Fingertips left figure (min x < 0.2): {max(left_figure_y)/height:.3f}")

# Let's write the results to a file or stdout
