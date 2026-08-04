#!/usr/bin/env python3
"""
audit_and_gate_tools.py
=======================
Tüm tools tablosundaki kayıtları KULLANICIYA GÖSTERİLEBİLİR mi diye sıkı denetler.

Bir aracın UI'da görünmesi (is_active=TRUE) için ŞART:
  1. Binary çalıştırılabilir olmalı:
       - binary_name dolu ise → which binary_name başarılı OLMALI, VEYA
       - command_template dolu ise → ilk token (program) PATH'de bulunmalı,
         VEYA absolute path olarak filesystem'da var olmalı.
  2. command_template ve binary_name ikisi de boşsa → asla aktif değil.

Aksi halde:
  - is_active = FALSE
  - exclusion_reason = uygun açıklama (zaten doluysa korur)

Kullanım:
    python3 audit_and_gate_tools.py            # rapor (dry-run)
    python3 audit_and_gate_tools.py --apply    # değişiklikleri uygula
"""

from __future__ import annotations

import argparse
import os
import shlex
import shutil
import subprocess
import sys
from collections import Counter
from typing import Optional

DSN = os.environ.get(
    "DATABASE_URL",
    "postgres://cybersec:${DB_PASSWORD:-changeme}@127.0.0.1:5432/cybersec_pro",
)


def first_token(template: Optional[str]) -> Optional[str]:
    if not template:
        return None
    template = template.strip()
    if not template:
        return None
    # Bazı şablonlar 'sudo nmap …' veya 'python3 -m foo' ile başlıyor
    try:
        toks = shlex.split(template, posix=True)
    except ValueError:
        toks = template.split()
    if not toks:
        return None
    cmd = toks[0]
    # sudo / env / time vs. başında ise gerçek komutu al
    skip = {"sudo", "env", "time", "nice", "ionice", "stdbuf", "/usr/bin/env"}
    i = 1
    while cmd in skip and i < len(toks):
        cmd = toks[i]
        i += 1
        if cmd.startswith("-") or "=" in cmd:  # env VAR=value
            if i < len(toks):
                cmd = toks[i]
                i += 1
            else:
                return None
    return cmd


def binary_exists(path_or_name: Optional[str]) -> bool:
    if not path_or_name:
        return False
    if path_or_name.startswith("/"):
        return os.path.isfile(path_or_name) and os.access(path_or_name, os.X_OK)
    return shutil.which(path_or_name) is not None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="DB'yi güncelle (yoksa sadece rapor)")
    args = parser.parse_args()

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("psycopg2 bulunamadı, yükleniyor…", file=sys.stderr)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "--break-system-packages", "psycopg2-binary"])
        import psycopg2
        import psycopg2.extras

    conn = psycopg2.connect(DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT id, name, binary_name, command_template, is_active,
               exclusion_reason, hardware_required, gui_required
        FROM tools
        ORDER BY name
    """)
    rows = cur.fetchall()

    to_activate: list[tuple[str, str]] = []      # (id, name)  artık çalışıyor
    to_deactivate: list[tuple[str, str, str]] = []  # (id, name, reason)
    keep_active: list[str] = []
    keep_inactive: list[str] = []

    reason_counter: Counter[str] = Counter()

    for r in rows:
        rid = r["id"]
        name = r["name"]
        bin_name = (r["binary_name"] or "").strip() or None
        tmpl = (r["command_template"] or "").strip() or None
        is_active = bool(r["is_active"])
        existing_excl = r["exclusion_reason"]
        hw = bool(r["hardware_required"])
        gui = bool(r["gui_required"])

        # Hardware/GUI gerektiren araçları kalıcı olarak dışla
        if hw:
            new_active = False
            reason = existing_excl or "hardware_required"
        elif gui:
            new_active = False
            reason = existing_excl or "gui_required"
        else:
            # Binary kontrolü
            bin_ok = binary_exists(bin_name) if bin_name else False
            tmpl_cmd = first_token(tmpl)
            tmpl_ok = binary_exists(tmpl_cmd) if tmpl_cmd else False

            if not tmpl:
                # Template yoksa backend smart_profile / kali_registry / fallback ile yürütebilir,
                # bu yüzden binary varsa aktif kalabilir.
                if bin_name and bin_ok:
                    new_active = True
                    reason = None
                elif bin_name and not bin_ok:
                    new_active = False
                    reason = f"binary_missing:{bin_name}"
                else:
                    new_active = False
                    reason = "no_binary_or_template"
            elif not tmpl_cmd:
                new_active = False
                reason = "template_unparseable"
            elif not tmpl_ok and not (bin_name and bin_ok):
                new_active = False
                reason = f"binary_missing:{tmpl_cmd}"
            else:
                new_active = True
                reason = None  # aktif kalmalı; varsa eski exclusion_reason'ı temizle

        # Mevcut exclusion_reason zaten lisans/iOS/windows ise koru
        if existing_excl in {"paid_license", "ios_only", "windows_only", "discontinued"}:
            new_active = False
            reason = existing_excl

        # Karar
        if new_active and not is_active:
            to_activate.append((rid, name))
        elif (not new_active) and is_active:
            to_deactivate.append((rid, name, reason or "missing"))
        elif new_active:
            keep_active.append(name)
        else:
            keep_inactive.append(name)

        if reason:
            reason_counter[reason.split(":")[0]] += 1

    print("=" * 70)
    print(f"TOPLAM TOOL: {len(rows)}")
    print(f"  Aktif kalacak (artık)  : {len(keep_active) + len(to_activate)}")
    print(f"    └ zaten aktifti      : {len(keep_active)}")
    print(f"    └ yeniden aktif      : {len(to_activate)}")
    print(f"  Pasif kalacak (artık)  : {len(keep_inactive) + len(to_deactivate)}")
    print(f"    └ zaten pasifti      : {len(keep_inactive)}")
    print(f"    └ yeni pasif         : {len(to_deactivate)}")
    print()
    print("Pasif sebep dağılımı:")
    for r, c in reason_counter.most_common():
        print(f"  {r:30s} {c}")
    print()
    if to_deactivate:
        print(f"Örnek deactivate (ilk 30):")
        for rid, name, reason in to_deactivate[:30]:
            print(f"  - {name:30s} {reason}")
    if to_activate:
        print(f"\nÖrnek activate (ilk 30):")
        for rid, name in to_activate[:30]:
            print(f"  + {name}")
    print()

    if not args.apply:
        print(">>> DRY-RUN. Uygulamak için --apply ekleyin.")
        return 0

    # APPLY
    print("DB güncelleniyor…")
    n_act = 0
    for rid, _ in to_activate:
        cur.execute(
            "UPDATE tools SET is_active=TRUE, exclusion_reason=NULL WHERE id=%s",
            (rid,),
        )
        n_act += 1

    n_de = 0
    for rid, _, reason in to_deactivate:
        cur.execute(
            "UPDATE tools SET is_active=FALSE, exclusion_reason=COALESCE(NULLIF(exclusion_reason,''), %s) WHERE id=%s",
            (reason, rid),
        )
        n_de += 1

    conn.commit()
    print(f"✓ Activated: {n_act}")
    print(f"✓ Deactivated: {n_de}")

    cur.execute("SELECT COUNT(*) AS c FROM tools WHERE is_active=TRUE")
    final_active = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) AS c FROM tools")
    total = cur.fetchone()["c"]
    print(f"\nFinal: {final_active}/{total} active")
    return 0


if __name__ == "__main__":
    sys.exit(main())
