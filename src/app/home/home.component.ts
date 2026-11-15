import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterExtensions } from '@nativescript/angular';
import { ImageSource, Page, Screen, isIOS } from '@nativescript/core';
import { shareFile } from '../native/files';
import { DialogService } from '../services/dialog.service';
import { DocActionsService } from '../services/doc-actions.service';
import { DrawerService } from '../services/drawer.service';
import { PreviewService, displayName, friendlyDate, kindColor, kindLabel } from '../services/preview.service';
import { SignatureService } from '../services/signature.service';
import { SignedFile, SigningService } from '../services/signing.service';
import { FilesLayout, UiPrefsService } from '../services/ui-prefs.service';
import { FREE_MONTHLY_LIMIT, ProService } from '../services/pro.service';

@Component({
  selector: 'app-home',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private readonly router = inject(RouterExtensions);
  private readonly signing = inject(SigningService);
  private readonly page = inject(Page);
  private readonly drawer = inject(DrawerService);
  private readonly dialogs = inject(DialogService);
  private readonly previews = inject(PreviewService);
  private readonly prefs = inject(UiPrefsService);
  readonly actions = inject(DocActionsService);
  readonly pro = inject(ProService);
  readonly freeLimit = FREE_MONTHLY_LIMIT;
  readonly signatures = inject(SignatureService);
  readonly signedFiles = this.signing.signedFiles;
  readonly layout = this.prefs.filesLayout;
  readonly isIOS = isIOS;

  /** Two-column grid rows. */
  readonly gridRows = computed(() => {
    const files = this.signedFiles();
    const rows: SignedFile[][] = [];
    for (let i = 0; i < files.length; i += 2) rows.push(files.slice(i, i + 2));
    return rows;
  });
  readonly tileW = (Screen.mainScreen.widthDIPs - 16 * 2 - 12) / 2;

  readonly kindLabel = kindLabel;
  readonly kindColor = kindColor;
  readonly displayName = displayName;
  readonly friendlyDate = friendlyDate;

  ngOnInit() {
    this.signing.refreshSignedFiles();
    this.page.actionBarHidden = false;
    this.page.on(Page.navigatedToEvent, () => this.signing.refreshSignedFiles());
  }

  greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  openMenu() {
    this.drawer.open();
  }

  editSignature() {
    this.router.navigate(['/signature']);
  }

  setLayout(l: FilesLayout) {
    this.prefs.setFilesLayout(l);
  }

  thumb(item: SignedFile): ImageSource | string | null {
    return this.previews.thumbnail(item.path, item.modified);
  }

  /**
   * On Android a tap on the share/delete buttons also reaches the tile underneath,
   * so the tile waits a moment and skips opening when a button handled the tap.
   */
  private buttonTapAt = 0;

  open(item: SignedFile) {
    setTimeout(() => {
      if (Date.now() - this.buttonTapAt < 400) return;
      this.router.navigate(['/preview'], { queryParams: { path: item.path, name: item.name, signed: '1' } });
    }, 60);
  }

  share(item: SignedFile) {
    this.buttonTapAt = Date.now();
    try {
      shareFile(item.path);
    } catch (e) {
      this.dialogs.error(e);
    }
  }

  async remove(item: SignedFile) {
    this.buttonTapAt = Date.now();
    const ok = await this.dialogs.confirm({
      title: 'Delete this file?',
      message: `"${displayName(item.name)}" will be removed from this device. This can't be undone.`,
      tone: 'delete',
      okText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    this.previews.forget(item.path);
    this.signing.deleteSigned(item.path);
  }
}
