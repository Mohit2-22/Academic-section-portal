import re
with open('app.py', encoding='utf-8') as f:
    source = f.read()
routes = re.findall(r"@app\.route\('([^']+)'", source)
print(f'Total routes found: {len(routes)}')
key_routes = ['/login','/logout','/api/student/profile','/api/student/timetable',
              '/api/faculty/lectures','/api/admin/students',
              '/api/admission/inquiries','/api/super_admin/dashboard']
for r in key_routes:
    print(f'  {r}: {"YES" if r in routes else "MISSING"}')
