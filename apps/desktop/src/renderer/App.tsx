import { useCallback, useEffect, useState, type FormEvent, type JSX } from 'react';
import type { Person } from '@kinlore/core';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function App(): JSX.Element {
  const [archivePath, setArchivePath] = useState<string | undefined>(undefined);
  const [people, setPeople] = useState<Person[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState('No archive open.');
  const [error, setError] = useState<string | undefined>(undefined);

  const refreshPeople = useCallback(async () => {
    const listed = await window.kinlore.listPeople();
    setPeople(listed);
  }, []);

  useEffect(() => {
    void window.kinlore.archiveStatus().then((current) => {
      if (current.rootPath === undefined) {
        return;
      }
      setArchivePath(current.rootPath);
      setStatus(`Archive: ${current.rootPath}`);
      void refreshPeople().catch((caught: unknown) => {
        setError(errorMessage(caught));
      });
    });
  }, [refreshPeople]);

  async function useFolder(action: 'create' | 'open', rootPath: string): Promise<void> {
    setError(undefined);
    const opened =
      action === 'create'
        ? await window.kinlore.createArchive(rootPath)
        : await window.kinlore.openArchive(rootPath);
    setArchivePath(opened);
    setStatus(`Archive: ${opened}`);
    await refreshPeople();
  }

  async function onDefault(action: 'create' | 'open'): Promise<void> {
    try {
      const rootPath = await window.kinlore.getDefaultArchivePath();
      await useFolder(action, rootPath);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function onChoose(action: 'create' | 'open'): Promise<void> {
    try {
      const chosen = await window.kinlore.selectArchiveFolder();
      if (chosen === undefined) {
        return;
      }
      await useFolder(action, chosen);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function onSavePerson(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (archivePath === undefined) {
      setError('Open or create an archive first.');
      return;
    }
    const name = displayName.trim();
    if (name === '') {
      setError('A person needs a name.');
      return;
    }
    try {
      setError(undefined);
      const now = new Date().toISOString();
      await window.kinlore.savePerson({
        id: crypto.randomUUID(),
        displayName: name,
        createdAt: now,
        updatedAt: now,
      });
      setDisplayName('');
      await refreshPeople();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <main className="page">
      <header>
        <p className="eyebrow">Local-first family archive</p>
        <h1>Kinlore</h1>
        <p className="lede">
          Your family&apos;s stories, in their own voices. Recordings stay on this computer. Nothing
          leaves the machine unless you choose to export it.
        </p>
      </header>

      <section className="panel">
        <h2>Archive</h2>
        <p className="status">{status}</p>
        <div className="actions">
          <button type="button" onClick={() => void onDefault('create')}>
            Create default archive
          </button>
          <button type="button" onClick={() => void onDefault('open')}>
            Open default archive
          </button>
          <button type="button" onClick={() => void onChoose('create')}>
            Create in folder…
          </button>
          <button type="button" onClick={() => void onChoose('open')}>
            Open folder…
          </button>
        </div>
        {error !== undefined ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel">
        <h2>People</h2>
        {people.length === 0 ? (
          <p className="muted">No people in this archive yet.</p>
        ) : (
          <ul>
            {people.map((person) => (
              <li key={person.id}>{person.displayName}</li>
            ))}
          </ul>
        )}
        <form onSubmit={(event) => void onSavePerson(event)}>
          <label htmlFor="displayName">Name</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
            placeholder="An elder, a cousin, you"
            autoComplete="name"
          />
          <button type="submit">Add person</button>
        </form>
      </section>
    </main>
  );
}
