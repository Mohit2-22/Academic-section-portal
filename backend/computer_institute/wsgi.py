"""
WSGI config for computer_institute project.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'computer_institute.settings')

application = get_wsgi_application()
