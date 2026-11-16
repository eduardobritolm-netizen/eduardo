"""Baixa diariamente o CSV oficial de Execução Orçamentária da SEFAZ-AM.

A exportação é feita pela própria interface pública de Dados Abertos, pois o portal
entrega o arquivo por download iniciado no navegador (blob), e não por uma URL
estável de CSV identificada no HTML público.
"""
from __future__ import annotations

import csv
import os
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

URL = "https://sistemas.sefaz.am.gov.br/transparencia/dadosabertos"
PASTA = Path(__file__).resolve().parents[1] / "fontes" / "sefaz"
CAMPOS = {
    "anoExercicio", "mesReferencia", "codUnidadeGestora", "desUnidadeGestora",
    "vadotacaoinicial", "vaautorizado", "vaempenhado", "valiquidado", "vapago",
}
UG_ESPERADAS = {"011103", "011706"}


def ano_corrente() -> int:
    return datetime.now(ZoneInfo("America/Manaus")).year


def validar_csv(caminho: Path, ano: int) -> tuple[int, set[str]]:
    if not caminho.is_file() or caminho.stat().st_size < 1_000:
        raise RuntimeError("A SEFAZ não gerou um arquivo CSV válido (arquivo ausente ou muito pequeno).")

    erros = []
    for encoding in ("cp1252", "latin-1", "utf-8-sig"):
        try:
            with caminho.open("r", encoding=encoding, newline="") as f:
                amostra = f.read(8192)
                f.seek(0)
                delimitador = ";" if amostra.count(";") >= amostra.count(",") else ","
                leitor = csv.DictReader(f, delimiter=delimitador)
                campos = set(leitor.fieldnames or [])
                faltantes = CAMPOS - campos
                if faltantes:
                    raise RuntimeError("CSV fora do dicionário esperado; campos ausentes: " + ", ".join(sorted(faltantes)))
                total = 0
                unidades = set()
                anos = set()
                for linha in leitor:
                    total += 1
                    ug = (linha.get("codUnidadeGestora") or "").strip().strip('"')
                    if ug in UG_ESPERADAS:
                        unidades.add(ug)
                    anos.add((linha.get("anoExercicio") or "").strip().strip('"'))
            if total == 0:
                raise RuntimeError("O CSV da SEFAZ está vazio.")
            if str(ano) not in anos:
                raise RuntimeError(f"O CSV não contém o exercício selecionado ({ano}).")
            if "011103" not in unidades:
                raise RuntimeError("O CSV não contém registros da unidade gestora da PGE (011103).")
            return total, unidades
        except UnicodeDecodeError as exc:
            erros.append(str(exc))
    raise RuntimeError("Não foi possível decodificar o CSV: " + "; ".join(erros))


def baixar(ano: int | None = None) -> Path:
    ano = ano or ano_corrente()
    PASTA.mkdir(parents=True, exist_ok=True)

    # Útil para testes locais; no GitHub Actions a variável não é definida.
    local = os.environ.get("SEFAZ_EXECUCAO_CSV")
    if local:
        caminho = Path(local).expanduser().resolve()
        total, unidades = validar_csv(caminho, ano)
        print(f"SEFAZ: CSV local validado ({total:,} registros; UGs {', '.join(sorted(unidades))}).")
        return caminho

    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright não instalado. Verifique o workflow do GitHub Actions.") from exc

    destino = PASTA / f"execucao_orcamentaria_{ano}.csv"
    parcial = PASTA / f"execucao_orcamentaria_{ano}.download"
    if parcial.exists():
        parcial.unlink()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(accept_downloads=True, locale="pt-BR")
        try:
            resposta = page.goto(URL, wait_until="domcontentloaded", timeout=120_000)
            if resposta and resposta.status >= 400:
                raise RuntimeError(f"Portal de Dados Abertos respondeu HTTP {resposta.status}.")
            seletor = page.locator("select").first
            seletor.wait_for(state="visible", timeout=90_000)
            seletor.select_option(str(ano))
            botao = page.get_by_role("button", name=re.compile(r"^\s*Exportar dados\s*$", re.I)).first
            botao.wait_for(state="visible", timeout=30_000)
            with page.expect_download(timeout=240_000) as evento:
                botao.click()
            download = evento.value
            erro = download.failure()
            if erro:
                raise RuntimeError(f"Falha no download informado pelo navegador: {erro}")
            download.save_as(str(parcial))
        finally:
            browser.close()

    total, unidades = validar_csv(parcial, ano)
    os.replace(parcial, destino)
    print(f"SEFAZ: download concluído — exercício {ano}, {total:,} registros, UGs {', '.join(sorted(unidades))}.")
    return destino


if __name__ == "__main__":
    baixar()
