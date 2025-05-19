import { useState, useEffect, useCallback, createContext, forwardRef, useImperativeHandle, useContext, useRef } from "react";
import ControlPanel from "./EditorHeader/ControlPanel";
import Canvas from "./EditorCanvas/Canvas";
import { CanvasContextProvider } from "../context/CanvasContext";
import SidePanel from "./EditorSidePanel/SidePanel";
import { DB, State } from "../data/constants";
import { db } from "../data/db";
import {
  useLayout,
  useSettings,
  useTransform,
  useDiagram,
  useUndoRedo,
  useAreas,
  useNotes,
  useTypes,
  useTasks,
  useSaveState,
  useEnums,
} from "../hooks";
import FloatingControls from "./FloatingControls";
import { Modal } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { databases } from "../data/databases";
import { isRtl } from "../i18n/utils/rtl";
import { useSearchParams } from "react-router-dom";
import { octokit } from "../data/octokit";
import { wsClient } from '../data/websocketClient';

export const IdContext = createContext({ gistId: "" });


const WorkSpace = forwardRef((props, ref) => {
  useImperativeHandle(ref, () => ({
    updateState: (newState) => {
      if (newState.id !== undefined) setId(newState.id);
      if (newState.title !== undefined) setTitle(newState.title);
      if (newState.database !== undefined) setDatabase(newState.database);
      if (newState.tables !== undefined) setTables(newState.tables);
      if (newState.relationships !== undefined) setRelationships(newState.relationships);
      if (newState.notes !== undefined) setNotes(newState.notes);
      if (newState.areas !== undefined) setAreas(newState.areas);
      if (newState.tasks !== undefined) setTasks(newState.tasks);
      if (newState.transform !== undefined) setTransform(newState.transform);
      if (newState.enums !== undefined) setEnums(newState.enums);
      if (newState.types !== undefined) setTypes(newState.types);
    }
  }));
  const [id, setId] = useState(0);
  const [gistId, setGistId] = useState("");
  const [loadedFromGistId, setLoadedFromGistId] = useState("");
  const [title, setTitle] = useState("Untitled Diagram");
  const [resize, setResize] = useState(false);
  const [width, setWidth] = useState(340);
  const [lastSaved, setLastSaved] = useState("");
  const [showSelectDbModal, setShowSelectDbModal] = useState(false);
  const [selectedDb, setSelectedDb] = useState("");
  const { layout } = useLayout();
  const { settings } = useSettings();
  const { types, setTypes } = useTypes();
  const { areas, setAreas } = useAreas();
  const { tasks, setTasks } = useTasks();
  const { notes, setNotes } = useNotes();
  const { saveState, setSaveState } = useSaveState();
  const { transform, setTransform } = useTransform();
  const { enums, setEnums } = useEnums();
  const {
    tables,
    relationships,
    setTables,
    setRelationships,
    database,
    setDatabase,
  } = useDiagram();
  const { undoStack, redoStack, setUndoStack, setRedoStack } = useUndoRedo();
  const { t, i18n } = useTranslation();
  let [searchParams, setSearchParams] = useSearchParams();
  const handleResize = (e) => {
    if (!resize) return;
    const w = isRtl(i18n.language) ? window.innerWidth - e.clientX : e.clientX;
    if (w > 340) setWidth(w);
  };


  const save = useCallback(async () => {
    if (saveState !== State.SAVING) return;

    const name = window.name.split(" ");
    const op = name[0];
    const saveAsDiagram = window.name === "" || op === "d" || op === "lt";

    if (saveAsDiagram) {
      searchParams.delete("shareId");
      setSearchParams(searchParams);
      if (id === 0) {
        try {
            const id = await db.diagrams.add({
              lastModified: new Date(),
              database: database,
              name: title,
              gistId: gistId ?? "",
              tables: tables,
              references: relationships,
              notes: notes,
              areas: areas,
              todos: tasks,
              pan: transform.pan,
              zoom: transform.zoom,
              loadedFromGistId: loadedFromGistId,
              ...(databases[database].hasEnums && { enums: enums }),
              ...(databases[database].hasTypes && { types: types }),
            });
            setId(id);
            window.name = `d ${id}`;
            setSaveState(State.SAVED);
            setLastSaved(new Date().toLocaleString());
            wsClient.send('diagramUpdate', { id });
            return id;
          } catch (error) {
            setSaveState(State.ERROR);
            throw error;
          }
      } else {
        try {
            await db.diagrams.update(id, {
              lastModified: new Date(),
              database: database,
              name: title,
              tables: tables,
              references: relationships,
              notes: notes,
              areas: areas,
              todos: tasks,
              gistId: gistId ?? "",
              pan: transform.pan,
              zoom: transform.zoom,
              loadedFromGistId: loadedFromGistId,
              ...(databases[database].hasEnums && { enums: enums }),
              ...(databases[database].hasTypes && { types: types }),
            });
            setSaveState(State.SAVED);
            setLastSaved(new Date().toLocaleString());
            wsClient.send('diagramUpdate', { id });
          } catch (error) {
            setSaveState(State.ERROR);
            throw error;
          }
      }
    } else {
      await db.templates
        .update(id, {
          database: database,
          title: title,
          tables: tables,
          relationships: relationships,
          notes: notes,
          subjectAreas: areas,
          todos: tasks,
          pan: transform.pan,
          zoom: transform.zoom,
          ...(databases[database].hasEnums && { enums: enums }),
          ...(databases[database].hasTypes && { types: types }),
        })
        .then(() => {
          setSaveState(State.SAVED);
          setLastSaved(new Date().toLocaleString());
            wsClient.send('diagramUpdate', { id });
        })
        .catch((error) => {
          setSaveState(State.ERROR);
        });
    }
  }, [
    searchParams,
    setSearchParams,
    tables,
    relationships,
    notes,
    areas,
    types,
    title,
    id,
    tasks,
    transform,
    setSaveState,
    database,
    enums,
    gistId,
    loadedFromGistId,
    saveState
  ]);

  const load = useCallback(async () => {
    const loadLatestDiagram = async () => {
      let diagrams = (await db.diagrams.toArray()) || [];
      if (!Array.isArray(diagrams)) diagrams = [];
      const d = diagrams.sort((a, b) => b.lastModified - a.lastModified)[0];
      if (d) {
        try {
          if (d.database) {
            setDatabase(d.database);
          } else {
            setDatabase(DB.GENERIC);
          }
          setId(d.id);
          setGistId(d.gistId);
          setLoadedFromGistId(d.loadedFromGistId);
          setTitle(d.name);
          setTables(d.tables);
          setRelationships(d.references);
          setNotes(d.notes);
          setAreas(d.areas);
          setTasks(d.todos ?? []);
          setTransform({ pan: d.pan, zoom: d.zoom });
          if (databases[database].hasTypes) {
            setTypes(d.types ?? []);
          }
          if (databases[database].hasEnums) {
            setEnums(d.enums ?? []);
          }
          window.name = `d ${d.id}`;
        } catch (error) {
          console.error('Error loading diagram:', error);
        }
      }
    };
    const loadDiagram = async (id) => {
      await db.diagrams
        .get(id)
        .then((result) => {
          if (result) {
            if(typeof result == 'string'){
              var c = JSON.parse(result);
            }else{
              var diagram = result;
            }
            if (diagram.database) {
              setDatabase(diagram.database);
            } else {
              setDatabase(DB.GENERIC);
            }
            setId(diagram.id);
            setGistId(diagram.gistId);
            setLoadedFromGistId(diagram.loadedFromGistId);
            setTitle(diagram.name);
            setTables(diagram.tables);
            setRelationships(diagram.references);
            setAreas(diagram.areas);
            setNotes(diagram.notes);
            setTasks(diagram.todos ?? []);
            setTransform({
              pan: diagram.pan,
              zoom: diagram.zoom,
            });
            setUndoStack([]);
            setRedoStack([]);
            if (databases[database].hasTypes) {
              setTypes(diagram.types ?? []);
            }
            if (databases[database].hasEnums) {
              setEnums(diagram.enums ?? []);
            }
            window.name = `d ${diagram.id}`;
          } else {
            window.name = "";
          }
        })
        .catch((error) => {
          console.log(error);
        });
    };

    const loadTemplate = async (id) => {
      await db.templates
        .get(id)
        .then((diagram) => {
          if (diagram) {
            if (diagram.database) {
              setDatabase(diagram.database);
            } else {
              setDatabase(DB.GENERIC);
            }
            setId(diagram.id);
            setTitle(diagram.title);
            setTables(diagram.tables);
            setRelationships(diagram.relationships);
            setAreas(diagram.subjectAreas);
            setTasks(diagram.todos ?? []);
            setNotes(diagram.notes);
            setTransform({
              zoom: 1,
              pan: { x: 0, y: 0 },
            });
            setUndoStack([]);
            setRedoStack([]);
            if (databases[database].hasTypes) {
              setTypes(diagram.types ?? []);
            }
            if (databases[database].hasEnums) {
              setEnums(diagram.enums ?? []);
            }
          } else {
            if (selectedDb === "") setShowSelectDbModal(true);
          }
        })
        .catch((error) => {
          console.log(error);
          if (selectedDb === "") setShowSelectDbModal(true);
        });
    };

    const loadFromGist = async (shareId) => {
      try {
        const res = await octokit.request(`GET /gists/${shareId}`, {
          gist_id: shareId,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
        const diagramSrc = res.data.files["share.json"].content;
        const d = JSON.parse(diagramSrc);
        setUndoStack([]);
        setRedoStack([]);
        setLoadedFromGistId(shareId);
        setDatabase(d.database);
        setTitle(d.title);
        setTables(d.tables);
        setRelationships(d.relationships);
        setNotes(d.notes);
        setAreas(d.subjectAreas);
        setTransform(d.transform);
        if (databases[d.database].hasTypes) {
          setTypes(d.types ?? []);
        }
        if (databases[d.database].hasEnums) {
          setEnums(d.enums ?? []);
        }
      } catch (e) {
        console.log(e);
        setSaveState(State.FAILED_TO_LOAD);
      }
    };

    const shareId = searchParams.get("shareId");
    if (shareId) {
      const existingDiagram = await db.diagrams.get({
        loadedFromGistId: shareId,
      });

      if (existingDiagram) {
        window.name = "d " + existingDiagram.id;
        setId(existingDiagram.id);
      } else {
        window.name = "";
        setId(0);
      }
      await loadFromGist(shareId);
      return;
    }

    if (window.name === "") {
      await loadDiagram(id);
    } else {
      const name = window.name.split(" ");
      const op = name[0];
      const id = parseInt(name[1]);
      switch (op) {
        case "d": {
          await loadDiagram(id);
          break;
        }
        case "t":
        case "lt": {
          await loadTemplate(id);
          break;
        }
        default:
          break;
      }
    }
  }, [
    setTransform,
    setRedoStack,
    setUndoStack,
    setRelationships,
    setTables,
    setAreas,
    setNotes,
    setTypes,
    setTasks,
    setDatabase,
    database,
    setEnums,
    selectedDb,
    setSaveState,
    searchParams,
  ]);

  useEffect(() => {
    if (
      tables?.length === 0 &&
      areas?.length === 0 &&
      notes?.length === 0 &&
      types?.length === 0 &&
      tasks?.length === 0
    )
      return;

    if (settings.autosave) {
      setSaveState(State.SAVING);
    }
  }, [
    undoStack,
    redoStack,
    settings.autosave,
    tables?.length,
    areas?.length,
    notes?.length,
    types?.length,
    relationships?.length,
    tasks?.length,
    transform.zoom,
    title,
    gistId,
    setSaveState,
  ]);

  const [version, setVersion] = useState(0);
  const [pendingUpdates, setPendingUpdates] = useState(new Set());
  const debounceTimeout = useRef(null);

  const handleDiagramUpdate = useCallback((event) => {
    const payload = event.detail;
    // 基础数据有效性验证
    if (!payload || typeof payload !== 'object') {
      console.warn('Invalid payload received:', payload);
      return;
    }

    // 确保ID匹配且版本号有效
    // if (payload.id !== id || typeof payload.version !== 'number') {
    //   return;
    // }
    
    // 处理本地更新
    if (pendingUpdates.has(payload.version)) {
      setPendingUpdates(prev => {
        const next = new Set(prev);
        next.delete(payload.version);
        return next;
      });
      return;
    }

    // 版本控制：确保按序处理更新
    if (payload.version <= version) {
      console.debug('Skipping outdated update:', payload.version, 'current:', version);
      return;
    }

    // 使用较短的防抖时间以提高实时性
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      setVersion(payload.version);
      
      // 批量更新状态以提高性能
      const updates = {};
      if (payload.tables) updates.tables = payload.tables;
      if (payload.relationships) updates.relationships = payload.relationships;
      if (payload.notes) updates.notes = payload.notes;
      if (payload.areas) updates.areas = payload.areas;
      if (payload.tasks) updates.tasks = payload.tasks;
      if (payload.transform) updates.transform = payload.transform;
      if (payload.types) updates.types = payload.types;
      if (payload.enums) updates.enums = payload.enums;

      // 执行状态更新
      Object.entries(updates).forEach(([key, value]) => {
        const setter = {
          tables: setTables,
          relationships: setRelationships,
          notes: setNotes,
          areas: setAreas,
          tasks: setTasks,
          transform: setTransform,
          types: setTypes,
          enums: setEnums
        }[key];
        if (setter) setter(value);
      });

      debounceTimeout.current = null;
    }, 50);
  }, [id, version, pendingUpdates]);

  useEffect(() => {
    wsClient.eventTarget.addEventListener('diagramData', handleDiagramUpdate);
    return () => wsClient.eventTarget.removeEventListener('diagramData', handleDiagramUpdate);
  }, [handleDiagramUpdate]);

  useEffect(() => {
    if (saveState === State.SAVING) {
      const newVersion = version + 1;
      setPendingUpdates(prev => new Set(prev).add(newVersion));
      setVersion(newVersion);
      save();
    }
  }, [saveState, save, version]);

  useEffect(() => {
    document.title = "Editor | drawDB";
    load();
  }, [load]);

  return (
    <div className="h-full flex flex-col overflow-hidden theme">
      <IdContext.Provider value={{ gistId, setGistId }}>
        <ControlPanel
          diagramId={id}
          setDiagramId={setId}
          title={title}
          setTitle={setTitle}
          lastSaved={lastSaved}
          setLastSaved={setLastSaved}
        />
      </IdContext.Provider>
      <div
        className="flex h-full overflow-y-auto"
        onPointerUp={(e) => e.isPrimary && setResize(false)}
        onPointerLeave={(e) => e.isPrimary && setResize(false)}
        onPointerMove={(e) => e.isPrimary && handleResize(e)}
        onPointerDown={(e) => {
          // Required for onPointerLeave to trigger when a touch pointer leaves
          // https://stackoverflow.com/a/70976017/1137077
          e.target.releasePointerCapture(e.pointerId);
        }}
        style={isRtl(i18n.language) ? { direction: "rtl" } : {}}
      >
        {layout.sidebar && (
          <SidePanel resize={resize} setResize={setResize} width={width} />
        )}
        <div className="relative w-full h-full overflow-hidden">
          <CanvasContextProvider className="h-full w-full">
            <Canvas saveState={saveState} setSaveState={setSaveState} />
          </CanvasContextProvider>
          {!(layout.sidebar || layout.toolbar || layout.header) && (
            <div className="fixed right-5 bottom-4">
              <FloatingControls />
            </div>
          )}
        </div>
      </div>
      <Modal
        centered
        size="medium"
        closable={false}
        hasCancel={false}
        title={t("pick_db")}
        okText={t("confirm")}
        visible={showSelectDbModal}
        onOk={() => {
          if (selectedDb === "") return;
          setDatabase(selectedDb);
          setShowSelectDbModal(false);
        }}
        okButtonProps={{ disabled: selectedDb === "" }}
      >
        <div className="grid grid-cols-3 gap-4 place-content-center">
          {Object.values(databases).map((x) => (
            <div
              key={x.name}
              onClick={() => setSelectedDb(x.label)}
              className={`space-y-3 py-3 px-4 rounded-md border-2 select-none ${
                settings.mode === "dark"
                  ? "bg-zinc-700 hover:bg-zinc-600"
                  : "bg-zinc-100 hover:bg-zinc-200"
              } ${selectedDb === x.label ? "border-zinc-400" : "border-transparent"}`}
            >
              <div className="font-semibold">{x.name}</div>
              {x.image && (
                <img
                  src={x.image}
                  className="h-10"
                  style={{
                    filter:
                      "opacity(0.4) drop-shadow(0 0 0 white) drop-shadow(0 0 0 white)",
                  }}
                />
              )}
              <div className="text-xs">{x.description}</div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
});

export default WorkSpace;

export const useWorkspaceState = () => useContext(WorkspaceStateContext);
