"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CLAVE_ADMIN_STORAGE_KEY = "civora-clave-admin";

function fechaLocalPorDefecto(): string {
  const dentroDeUnaHora = new Date(Date.now() + 60 * 60 * 1000);
  dentroDeUnaHora.setMinutes(dentroDeUnaHora.getMinutes() - dentroDeUnaHora.getTimezoneOffset());
  return dentroDeUnaHora.toISOString().slice(0, 16);
}

function claveAdminGuardada(): string {
  try {
    return sessionStorage.getItem(CLAVE_ADMIN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function NuevaPropuestaPage() {
  const router = useRouter();
  const [claveAdmin, setClaveAdmin] = useState(claveAdminGuardada);
  const [titulo, setTitulo] = useState("");
  const [pregunta, setPregunta] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaApertura, setFechaApertura] = useState(fechaLocalPorDefecto());
  const [duracionDias, setDuracionDias] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!claveAdmin.trim()) {
      setError("Introduce la clave de administrador.");
      return;
    }
    if (!titulo.trim() || !pregunta.trim()) {
      setError("El título y la pregunta son obligatorios.");
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await fetch("/api/propuestas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": claveAdmin.trim() },
        body: JSON.stringify({
          titulo: titulo.trim(),
          pregunta: pregunta.trim(),
          descripcion: descripcion.trim(),
          fechaApertura: new Date(fechaApertura).toISOString(),
          duracionDias,
        }),
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) {
        setError(cuerpo.error ?? "No se ha podido crear la propuesta.");
        return;
      }
      try {
        sessionStorage.setItem(CLAVE_ADMIN_STORAGE_KEY, claveAdmin.trim());
      } catch {
        // almacenamiento no disponible (navegacion privada, etc.); no es critico
      }
      router.push(`/propuestas`);
    } catch {
      setError("No se ha podido contactar con el servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="wrap page-shell">
      <div className="page-head">
        <h1>Nueva propuesta</h1>
        <p>
          Se crea en el contrato público (paga el gas el relayer de esta
          instancia) y queda abierta a votación en la fecha que elijas.
        </p>
      </div>

      <form className="panel" onSubmit={enviar}>
        <div className="form-field">
          <label htmlFor="clave-admin">Clave de administrador</label>
          <input
            id="clave-admin"
            type="password"
            value={claveAdmin}
            onChange={(evento) => setClaveAdmin(evento.target.value)}
            autoComplete="off"
          />
          <p className="form-hint">Solo quien la tenga puede crear propuestas.</p>
        </div>

        <div className="form-field">
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            type="text"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            placeholder="Presupuestos participativos 2027"
          />
        </div>

        <div className="form-field">
          <label htmlFor="pregunta">¿Qué se quiere votar?</label>
          <input
            id="pregunta"
            type="text"
            value={pregunta}
            onChange={(evento) => setPregunta(evento.target.value)}
            placeholder="¿Apruebas la propuesta de presupuestos participativos 2027?"
          />
        </div>

        <div className="form-field">
          <label htmlFor="descripcion">Descripción (opcional)</label>
          <input
            id="descripcion"
            type="text"
            value={descripcion}
            onChange={(evento) => setDescripcion(evento.target.value)}
            placeholder="Contexto breve de la propuesta"
          />
        </div>

        <div className="form-field">
          <label htmlFor="fecha-apertura">Fecha de apertura</label>
          <input
            id="fecha-apertura"
            type="datetime-local"
            value={fechaApertura}
            onChange={(evento) => setFechaApertura(evento.target.value)}
          />
          <p className="form-hint">Desde este instante se podrá votar.</p>
        </div>

        <div className="form-field">
          <label htmlFor="duracion">Días abierta</label>
          <input
            id="duracion"
            type="number"
            min={1}
            max={365}
            value={duracionDias}
            onChange={(evento) => setDuracionDias(Number(evento.target.value))}
          />
          <p className="form-hint">
            Cierra automáticamente {duracionDias} días después de la apertura.
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={enviando}>
          {enviando ? "Creando…" : "Crear propuesta"}
        </button>
      </form>
    </main>
  );
}
