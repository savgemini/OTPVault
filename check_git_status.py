import subprocess
import os

os.chdir(r'c:\Users\User\Downloads\project-bolt-sb1-qiairnhf\project')

# Check status
result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True)
with open('git_status_check.txt', 'w') as f:
    f.write('=== Git Status (porcelain) ===\n')
    f.write(result.stdout)
    if result.stderr:
        f.write(f'\nErrors: {result.stderr}\n')
    f.write(f'\nReturn code: {result.returncode}\n')

# Check log
result = subprocess.run(['git', 'log', '--oneline', '-5'], capture_output=True, text=True)
with open('git_status_check.txt', 'a') as f:
    f.write('\n=== Last 5 Commits ===\n')
    f.write(result.stdout)
    if result.stderr:
        f.write(f'\nErrors: {result.stderr}\n')

# Check remote
result = subprocess.run(['git', 'remote', '-v'], capture_output=True, text=True)
with open('git_status_check.txt', 'a') as f:
    f.write('\n=== Remote ===\n')
    f.write(result.stdout)

print('Git status written to git_status_check.txt')
