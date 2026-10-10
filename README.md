# Resume renderer · web

`main`의 Markdown을 한 페이지의 정적 이력서로 렌더링하는 Astro 프로젝트입니다. React, 서버 런타임, 외부 웹 폰트는 사용하지 않습니다. GitHub project Pages의 `https://ensia96.github.io/resume/`를 기준으로 자산 경로와 canonical URL을 구성했지만, **현재 단계에는 workflow나 실제 배포가 없습니다.**

## 브랜치와 작업 경계

- **`main`**: `1. 개요.md` ~ `6. 기타.md` 콘텐츠의 유일한 원본. 추후 연결용 `.github` 정의를 별도 단계에서 추가할 수 있습니다.
- **`web`**: 렌더러, 스타일, 브라우저 기능과 개발 문서. 콘텐츠를 복사하거나 merge해서 이중 관리하지 않습니다.
- **`~/projects/resume` 한 경로**에서 `git switch main` / `git switch web`으로 전환합니다. 처음 사용했던 `hosting` 브랜치는 `web`으로 변경했고, 별도 `resume-hosting` worktree는 제거했습니다.
- `web`에서는 상속 Markdown을 삭제했지만 `main`의 원본 6개 문서는 그대로 보존합니다. 렌더러는 `main` Git ref에서 원문을 직접 읽으므로 별도 콘텐츠 디렉터리는 로컬 실행에 필요하지 않습니다.
- 전환 전 사용자 작업을 해당 브랜치에 보존하세요. Git이 미커밋 변경 때문에 전환을 막으면 덮어쓰거나 강제 전환하지 마세요. 문서 변경은 `main`에서 사용자가 커밋한 다음 `web`으로 전환하면 기본 콘텐츠 입력에 반영됩니다.
- `node_modules/`, `.astro/`, `dist/`는 브랜치를 전환해도 남는 정상적인 로컬 설치/생성 폴더입니다. `web`의 `.gitignore`와 별개로 이 세 폴더만 로컬 `.git/info/exclude`에도 등록해 `main`에서 추적되지 않게 했습니다. `main`의 추적 파일에는 ignore 설정이나 렌더러 코드를 추가하지 않았습니다.

## 설치와 실행

Node **22.12.0 이상**, npm **9.6.5 이상** 및 Git이 필요합니다. 권장 환경은 지원 중인 Node LTS입니다. 실제 검증 환경은 Node 26.10.0 / npm 11.19.1입니다. 정식 Astro 7.3.8과 lockfile을 사용합니다.

동일한 저장소 경로의 `web` 브랜치에서 실행합니다.

```sh
cd ~/projects/resume
git switch web
npm ci
npm run dev
# http://127.0.0.1:4321/resume/

npm run check
npm test
npm run build
npm run preview
# http://127.0.0.1:4321/resume/
```

개발 서버와 preview는 기본적으로 loopback에만 바인딩됩니다. 포트가 사용 중이면 Astro 로그에 표시된 실제 포트를 확인하세요. `dist/`, `.astro/`, `node_modules/` 및 `artifacts/`는 Git에서 제외합니다. preview는 마지막으로 빌드한 `dist/`를 보여 줍니다.

## 콘텐츠 입력 인터페이스

### 1. Git ref 입력 — 기본값 `main`

```sh
npm run build
RESUME_CONTENT_REF=main npm run build
RESUME_CONTENT_REF=<문서-커밋-SHA> npm run build
```

렌더러 저장소의 ref를 먼저 commit SHA로 확정하고, `git ls-tree --full-tree` / `git show`로 해당 커밋의 **루트 번호 문서**만 읽습니다. 원본 worktree를 수정하거나 콘텐츠 파일을 web 브랜치에 생성하지 않습니다. `main`의 미커밋 변경은 이 모드에 반영되지 않습니다. ref는 로컬에 존재해야 하며 자동 fetch/pull/원격 명령은 수행하지 않습니다.

### 2. 별도 콘텐츠 디렉터리 입력 — ref보다 우선

```sh
RESUME_CONTENT_DIR=/path/to/main-checkout npm run dev
RESUME_CONTENT_DIR=../content npm run build
```

`RESUME_CONTENT_DIR`의 루트 번호 문서를 직접 읽습니다. 상대 경로는 명령을 실행하는 app 디렉터리 기준입니다. 별도 `main` checkout뿐 아니라 Git이 없는 디렉터리도 지원하며, 이 모드는 미커밋 콘텐츠 변경도 포함합니다. 이 입력은 별도 checkout이 있는 CI 등에 사용합니다. 현재 단일 경로 로컬 실행은 이 변수를 설정하지 않고 기본 `main` ref를 사용하세요. `web`을 checkout한 `~/projects/resume`에는 번호 문서가 없으므로 콘텐츠 디렉터리로 지정할 수 없습니다.

추후 CI의 두 checkout 구조는 다음처럼 연결할 수 있습니다. **현재 workflow는 만들지 않습니다.**

```text
workspace/
├── app/       # web checkout; npm ci / npm run build 실행 위치
└── content/   # main의 지정 SHA checkout; Markdown 원본

app에서: RESUME_CONTENT_DIR=../content npm run build
```

개발 모드에서 외부 Git ref/디렉터리 변경은 Vite가 자동으로 감시하지 않습니다. 콘텐츠 변경 후 페이지를 새로고침하면 다시 읽습니다. 정적 결과에는 재빌드가 필요합니다.

### 출처 기록

- HTML의 `meta[name="resume-content-sha"]`
- `/resume/content-source.json` (`dist/content-source.json`)
- 화면 footer의 짧은 SHA

Git ref 모드의 SHA는 정확한 콘텐츠 커밋입니다. 디렉터리가 Git checkout 루트이면 해당 HEAD와 번호 문서의 `dirty` 여부를 기록합니다. `dirty: true`이면 SHA만으로 로컬 변경까지 재현할 수 없고, 화면에도 로컬 변경 포함을 표시합니다. 일반 디렉터리는 `sha: null`이며 커밋 출처를 추정하지 않습니다. 로컬 절대경로는 결과에 공개하지 않습니다.

## 메타데이터와 원문

`src/lib/content.ts`에서 frontmatter를 본문과 분리해 검증합니다.

- 파일명: `1. 이름.md`, `2. 이름.md`, … (1부터 연속된 고유 정수 번호)
- `title`: 비어 있지 않은 문자열. 화면에서는 선행 번호를 정리합니다.
- `date`: 선택적 **문서 기준일**. 마지막 수정 시각을 의미하지 않습니다.
- `updatedAt`: 명시적으로 작성했을 때만 **마지막 수정**으로 표시합니다. `date`, 파일 mtime 또는 Git 커밋 시각에서 자동 추론하지 않습니다.
- 날짜는 `YYYY-MM-DD` 또는 `YYYY-MM-DD HH:mm:ss` / `YYYY-MM-DDTHH:mm:ss` 형식입니다. timestamp에는 `Z`나 `±HH:mm`을 붙일 수 있습니다. 유효한 달력 날짜/시각인지 검사하며 화면은 날짜만 보여 주고 `<time datetime>`에는 원래 시각을 유지합니다. 시간대가 없는 날짜를 다른 시간대로 변환하지 않습니다.

본문 내용·성과·연락처·외부 링크는 수정하지 않습니다. Markdown의 첫 `## 제목`이 영역 제목과 정확히 같을 때만 중복 표시를 제거합니다. 나머지 제목/본문/표/리스트는 그대로 렌더링하며, smart punctuation 자동 치환은 꺼 두었습니다. 영역은 파일 번호순으로 한 페이지에 표시합니다.

이 렌더러의 Markdown은 저장소 소유자가 관리하는 **신뢰된 콘텐츠**입니다. 임의 사용자 HTML 입력을 받는 서비스로 사용하기 위한 sanitizer는 포함하지 않았습니다. 현 문서에는 로컬 이미지가 없으며, 향후 이미지 파일을 main에 추가할 경우 별도 자산 공급 인터페이스가 필요합니다. 현재 번호 Markdown만 읽고 이미지 파일을 복사하지 않습니다.

## 구조

```text
src/
├── components/  # 영역 메타정보, 영역 nav, 인쇄 버튼 + 해당 동작
├── layouts/     # lang/SEO/canonical, 공통 레이아웃
├── lib/         # Git/디렉터리 입력과 YAML 검증, Markdown 변환
├── pages/       # 한 페이지 이력서, 콘텐츠 출처 JSON
└── styles/      # screen.css / print.css
tests/           # Node 내장 test runner; 콘텐츠/메타정보/렌더링 검증
```

자바스크립트는 `PrintButton.astro`의 컴포넌트 스크립트만 사용합니다. 이력서 본문은 정적 HTML이므로 JS 없이도 읽을 수 있으며, JS가 없을 때 동작하지 않는 버튼은 숨깁니다. nav/섹션 앵커는 같은 페이지 fragment로, CSS는 Astro의 Pages base를 적용한 자산 경로로 연결합니다. Markdown 소제목 ID는 영역별 namespace를 적용합니다. 모바일의 넓은 표는 키보드로 초점을 줄 수 있는 이름 있는 스크롤 영역에서 가로로 볼 수 있습니다.

## 인쇄 / PDF 저장

“인쇄 / PDF 저장”은 **`window.print()`로 브라우저 인쇄 대화상자를 여는 버튼**입니다. 서버에서 미리 생성한 PDF를 다운로드하는 기능이 아닙니다. PDF 파일은 브라우저에서 “PDF로 저장”을 선택해 만듭니다.

- A4, 위 14mm / 좌우 15mm / 아래 15mm 여백
- 인쇄에서 nav, 버튼, footer 숨김
- 화면의 표 스크롤을 해제해 모든 열을 출력
- 짧은 경력 항목과 표 행은 중간 분리 방지, 큰 항목은 자연스럽게 분할 가능
- 여러 페이지에 걸친 표의 헤더 반복, 제목이 페이지 끝에 홀로 남지 않도록 제어
- 긴 외부 URL을 링크 뒤에 추가하지 않음; 원문 링크는 PDF에 유지

브라우저 인쇄 설정에서 **A4 / 배율 100% / 머리글·바닥글 끄기**를 권장합니다. 브라우저·OS·폰트 및 사용자가 설정한 배율/여백에 따라 페이지 수가 달라질 수 있습니다.

### 로컬 검증 기록

- `npm run check`: Astro + TypeScript 오류/경고 0
- `npm test`: 메타정보/본문 보존, Git ref 및 디렉터리 입력, 정렬/오류 검증, Markdown 표/앵커 테스트
- `npm run build`: 기본 main, 고정 SHA 및 별도 main checkout 디렉터리로 모두 성공
- 별도 콘텐츠 디렉터리를 입력한 `npm run dev -- --port 4322`도 Chromium에서 6개 영역/출처 JSON/자산 요청 오류 없이 확인
- 프로젝트 밖 임시 Playwright Chromium 검증: 데스크톱 1440px, 모바일 320/390/768px에서 페이지 가로 넘침 없음, 본문 텍스트와 외부 링크 원문 일치, base 경로 자산 성공, 키보드 skip link/nav, JS 없는 정적 본문, 인쇄 버튼 호출 확인
- axe WCAG 2/2.1 A·AA 자동 검사: 1440px와 390px 모두 위반 0건 (접근성 전체 준수나 수동 스크린리더 검증을 보장하는 결과는 아님)
- 실제 Chromium A4 PDF: **3페이지**, 본문 요소 105개 보존, 표 25행과 경력 그룹 5개의 페이지 중간 분리 없음. 행사 표 헤더 반복과 모든 페이지 이미지를 확인. 텍스트 bounding box가 인쇄 여백 안에 있는지 검사하고 주요 성과/마지막 표 행/마지막 리스트가 포함됐는지 확인
- 스크린샷/PDF/검증 보고서는 프로젝트 밖 임시 디렉터리에서만 생성하고 추적하지 않았으며, 단일 작업 경로 정리 시 해당 임시 디렉터리와 검증 도구를 제거함. 위 결과는 당시 수행한 검증 기록

Safari/Firefox, 수동 스크린리더, 실제 프린터, 모바일 OS 인쇄 대화상자 및 공개 Pages 배포는 아직 검증하지 않았습니다. Playwright/axe/PDF 검증 도구는 영구 프로젝트 의존성에 추가하지 않았습니다.

## 후속 단계 — 이번 범위 밖

1. 화면/인쇄 결과를 사용자와 검토
2. web의 독립 Pages workflow 작성: `app/`와 `content/`를 각각 checkout해 콘텐츠 SHA 고정 후 빌드/배포
3. 실제 `/resume/` 배포와 자산 경로 검증
4. 그 뒤 별도 승인 아래 main의 연결 workflow 및 필요 시 블로그 cross-repo dispatch 설계

기본 브랜치 workflow 등록 정의, 토큰 권한, 호출 접수와 배포 완료의 차이는 후속 단계에서 다룹니다. 브랜치 전환을 위해 사용자 승인 아래 web 렌더러만 로컬 커밋했으며, main 변경/커밋, secrets 조회, dispatch, push, 원격 실행은 하지 않았습니다.
