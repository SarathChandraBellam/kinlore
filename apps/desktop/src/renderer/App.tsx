import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { PreferredLanguage } from '@kinlore/core';
import type { ArchiveStatus, LibrarySnapshot } from '@kinlore/ipc-contract';
import { ArchiveSetup } from './archive-setup.js';
import { chooseArchive, discoverArchive, invocationMessage } from './archive-flow.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { Icon, type IconName } from './components/Icons.js';
import { StatusBanner } from './components/StatusBanner.js';
import { ExistingArchive } from './existing-archive.js';
import { translate, type CopyKey } from './i18n.js';
import { FamilyPage, type FamilySection } from './pages/FamilyPage.js';
import { HomePage } from './pages/HomePage.js';
import { MemoriesPage, type MemorySection } from './pages/MemoriesPage.js';
import { RecordPage } from './pages/RecordPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import {
  EMPTY_LIBRARY,
  LANGUAGE_OPTIONS,
  type RunWorkOptions,
  type Section,
} from './pages/shared.js';

export { Home } from './pages/HomePage.js';
export { RecordingRow } from './pages/MemoriesPage.js';

const NAV: readonly { id: Section; key: CopyKey; icon: IconName }[] = [
  { id: 'home', key: 'navHome', icon: 'home' },
  { id: 'people', key: 'familySpace', icon: 'people' },
  { id: 'interview', key: 'recordSpace', icon: 'mic' },
  { id: 'library', key: 'memoriesSpace', icon: 'book' },
  { id: 'settings', key: 'navSettings', icon: 'settings' },
];

const MEMORY_SECTIONS: readonly MemorySection[] = [
  'library',
  'ask',
  'stories',
  'keepsakes',
  'cookbook',
  'timeline',
  'sealed',
];

function isMemorySection(section: Section): section is MemorySection {
  return (MEMORY_SECTIONS as readonly string[]).includes(section);
}

function isFamilySection(section: Section): section is FamilySection {
  return section === 'people' || section === 'family';
}

export function App(): JSX.Element {
  const [language, setLanguage] = useState<PreferredLanguage>('en');
  const t = useCallback((key: CopyKey) => translate(language, key), [language]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  return (
    <ErrorBoundary
      title={t('errorBoundaryTitle')}
      body={t('errorBoundaryBody')}
      reloadLabel={t('reloadApp')}
    >
      <AppShell language={language} setLanguage={setLanguage} t={t} />
    </ErrorBoundary>
  );
}

function AppShell(props: {
  language: PreferredLanguage;
  setLanguage: (language: PreferredLanguage) => void;
  t: (key: CopyKey) => string;
}): JSX.Element {
  const { language, setLanguage, t } = props;
  const [section, setSection] = useState<Section>('home');
  const [archive, setArchive] = useState<ArchiveStatus>({
    rootPath: undefined,
    encrypted: false,
    unlocked: false,
  });
  const [library, setLibrary] = useState<LibrarySnapshot>(EMPTY_LIBRARY);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pendingRoot, setPendingRoot] = useState<string>();
  const [existingRoot, setExistingRoot] = useState<string>();
  const [replacing, setReplacing] = useState(false);
  const [pendingNav, setPendingNav] = useState<Section>();
  const startup = useRef<Promise<ArchiveStatus> | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [unsavedRecording, setUnsavedRecording] = useState(false);
  const running = useRef(false);

  const reload = useCallback(async () => {
    const status = await window.kinlore.archiveStatus();
    setArchive(status);
    if (!status.unlocked) {
      setLibrary(EMPTY_LIBRARY);
      return;
    }
    setLibrary(await window.kinlore.loadLibrary());
  }, []);

  useEffect(() => {
    let active = true;
    startup.current ??= discoverArchive(window.kinlore);
    void startup.current
      .then(async (status) => {
        if (!active) return;
        setArchive(status);
        if (status.unlocked) {
          const next = await window.kinlore.loadLibrary();
          if (active) setLibrary(next);
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(invocationMessage(caught));
      });
    return () => {
      active = false;
    };
  }, []);

  async function run(work: () => Promise<void>, options?: RunWorkOptions): Promise<void> {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setSuccess(false);
    try {
      setError(undefined);
      await work();
      await reload();
      if (!options?.silent) {
        setSuccess(true);
      }
    } catch (caught) {
      setError(invocationMessage(caught));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function applyNavigation(next: Section): void {
    setError(undefined);
    setSuccess(false);
    setSection(next);
  }

  function navigate(next: Section): void {
    if (next === section) return;
    if (unsavedRecording) {
      setPendingNav(next);
      return;
    }
    applyNavigation(next);
  }

  async function useFolder(action: 'create' | 'open', rootPath: string): Promise<void> {
    const choice = await chooseArchive(window.kinlore, rootPath, action);
    if (choice === 'existing') {
      setExistingRoot(rootPath);
      return;
    }
    if (choice === 'create') {
      setReplacing(false);
      setPendingRoot(rootPath);
      return;
    }
    const status = await window.kinlore.openArchive(rootPath);
    setArchive(status);
    if (status.unlocked) {
      setLibrary(await window.kinlore.loadLibrary());
    } else {
      setLibrary(EMPTY_LIBRARY);
    }
    setSection('home');
  }

  async function onArchive(action: 'create' | 'open', folder: boolean): Promise<void> {
    await run(async () => {
      const rootPath = folder
        ? await window.kinlore.selectArchiveFolder()
        : await window.kinlore.getDefaultArchivePath();
      if (rootPath === undefined) {
        return;
      }
      await useFolder(action, rootPath);
    });
  }

  const primary: Section = isFamilySection(section)
    ? 'people'
    : isMemorySection(section)
      ? 'library'
      : section;
  const title = NAV.find((item) => item.id === primary)?.key ?? 'navHome';
  const intros: Partial<Record<Section, CopyKey>> = {
    people: 'familyIntro',
    library: 'memoriesIntro',
    interview: 'recordIntro',
    settings: 'settingsIntro',
  };
  const introKey = intros[primary];

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        {t('skipContent')}
      </a>

      <ConfirmDialog
        open={pendingNav !== undefined}
        title={t('discard')}
        message={t('discardRecording')}
        confirmLabel={t('discard')}
        cancelLabel={t('cancel')}
        tone="danger"
        onCancel={() => setPendingNav(undefined)}
        onConfirm={() => {
          const target = pendingNav;
          setPendingNav(undefined);
          setUnsavedRecording(false);
          if (target !== undefined) {
            applyNavigation(target);
          }
        }}
      />

      {existingRoot !== undefined ? (
        <ExistingArchive
          rootPath={existingRoot}
          t={t}
          onOpen={async () => {
            await useFolder('open', existingRoot);
            setExistingRoot(undefined);
          }}
          onChoose={() => {
            setExistingRoot(undefined);
            void onArchive('create', true);
          }}
          onReplace={() => {
            setPendingRoot(existingRoot);
            setReplacing(true);
            setExistingRoot(undefined);
          }}
          onClose={() => setExistingRoot(undefined)}
        />
      ) : null}

      {pendingRoot !== undefined ? (
        <ArchiveSetup
          t={t}
          replacing={replacing}
          onCreate={async (passphrase) => {
            const created = await window.kinlore.createArchive(pendingRoot, passphrase, replacing);
            setArchive(created.status);
            setLibrary(EMPTY_LIBRARY);
            return created;
          }}
          onClose={(created) => {
            setPendingRoot(undefined);
            setReplacing(false);
            setSuccess(false);
            if (created) setSection('people');
          }}
        />
      ) : null}

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            k
          </span>
          <div>
            <h1>
              kinlore<span>.</span>
            </h1>
            <p>{t('eyebrow')}</p>
          </div>
        </div>
        <nav aria-label="Primary">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={primary === item.id ? 'nav current' : 'nav'}
              aria-current={primary === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} size={20} />
              <span>{t(item.key)}</span>
              {item.id === 'library' && library.recordings.length > 0 ? (
                <span className="nav-count">{library.recordings.length}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="privacy-dot" aria-hidden="true" />
          <p>
            {t(archive.encrypted ? 'encryptedLabel' : 'privateLabel')}
            <small>{t('privateHelp')}</small>
          </p>
        </div>
      </aside>

      <main className="page" id="main-content">
        <header className="topbar">
          <span>{t('eyebrow')}</span>
          <label className="language">
            <span className="sr-only">{t('languageLabel')}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as PreferredLanguage)}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        <div className="page-content">
          <header className="page-heading">
            <div>
              <p className="eyebrow">Kinlore / {t(title)}</p>
              <h2>{t(title)}</h2>
              {introKey !== undefined ? <p className="muted">{t(introKey)}</p> : null}
            </div>
            {archive.unlocked && archive.encrypted && primary !== 'interview' ? (
              <button type="button" className="record-cta" onClick={() => navigate('interview')}>
                <Icon name="mic" size={17} />
                {t('recordStory')}
              </button>
            ) : null}
          </header>

          {error !== undefined ? (
            <StatusBanner
              tone="error"
              message={error}
              dismissLabel={t('dismiss')}
              onDismiss={() => setError(undefined)}
            />
          ) : null}

          {busy ? (
            <StatusBanner tone="info" message={t('working')} />
          ) : success ? (
            <StatusBanner
              tone="success"
              message={t('updated')}
              dismissLabel={t('dismiss')}
              onDismiss={() => setSuccess(false)}
            />
          ) : null}

          {archive.unlocked &&
          !archive.encrypted &&
          section !== 'settings' &&
          section !== 'home' ? (
            <StatusBanner
              tone="warning"
              title={t('encryptionRequired')}
              message={t('encryptionRequiredHelp')}
              actionLabel={t('goToSettings')}
              onAction={() => navigate('settings')}
            />
          ) : null}

          <fieldset className="workspace-fieldset" disabled={busy}>
            {section === 'home' ? (
              <HomePage
                t={t}
                archive={archive}
                library={library}
                language={language}
                onNavigate={navigate}
                onArchive={(action, folder) => void onArchive(action, folder)}
                run={run}
                onLock={async () => {
                  await run(async () => {
                    await window.kinlore.lockArchive();
                  });
                }}
              />
            ) : null}

            {!archive.unlocked && section !== 'home' && section !== 'settings' ? (
              <section className="empty-state panel">
                <Icon name={archive.encrypted ? 'lock' : 'book'} size={30} />
                <h3>{t(archive.encrypted ? 'locked' : 'beginTitle')}</h3>
                <p>{t(archive.encrypted ? 'unlockHomeBody' : 'archiveHelp')}</p>
                <button type="button" onClick={() => navigate('home')}>
                  <Icon name={archive.encrypted ? 'unlock' : 'shield'} size={16} />
                  {t(archive.encrypted ? 'unlock' : 'startArchive')}
                </button>
              </section>
            ) : null}

            {archive.unlocked && archive.encrypted && isFamilySection(section) ? (
              <FamilyPage
                section={section}
                library={library}
                language={language}
                t={t}
                run={run}
                onNavigate={navigate}
              />
            ) : null}

            {archive.unlocked && archive.encrypted && section === 'interview' ? (
              <RecordPage
                library={library}
                language={language}
                t={t}
                run={run}
                onDirtyChange={setUnsavedRecording}
                onMemories={() => navigate('library')}
                onGoFamily={() => navigate('people')}
              />
            ) : null}

            {archive.unlocked && archive.encrypted && isMemorySection(section) ? (
              <MemoriesPage
                section={section}
                library={library}
                language={language}
                t={t}
                run={run}
                onNavigate={navigate}
              />
            ) : null}

            {section === 'settings' ? (
              <SettingsPage
                archive={archive}
                library={library}
                t={t}
                run={run}
                onArchive={(action, folder) => void onArchive(action, folder)}
              />
            ) : null}
          </fieldset>

          <footer className="page-footer">
            <span>Kinlore</span>
            <span aria-hidden="true">·</span>
            <span>{t('privateHelp')}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
