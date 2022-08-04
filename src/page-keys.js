import '@polymer/app-route/app-route.js';
import '@mistio/mist-list/mist-list.js';
import '@polymer/paper-fab/paper-fab.js';
import './keys/key-actions.js';
import './keys/key-add.js';
import './keys/key-page.js';
import { html } from '@polymer/polymer/lib/utils/html-tag.js';
import { PolymerElement } from '@polymer/polymer/polymer-element.js';
import { mixinBehaviors } from '@polymer/polymer/lib/legacy/class.js';
import { ownerFilterBehavior } from './helpers/owner-filter-behavior.js';
import { mistListsBehavior } from './helpers/mist-lists-behavior.js';
import { store } from './redux/redux-store.js';
import reduxDataProvider from './redux/redux-data-provider.js';

/* eslint-disable class-methods-use-this */
export default class PageKeys extends mixinBehaviors(
  [mistListsBehavior, ownerFilterBehavior, window.rbac],
  PolymerElement
) {
  static get template() {
    return html`
      <style include="shared-styles">
        [hidden] {
          display: none !important;
        }

        paper-dialog {
          position: fixed !important;
        }
      </style>
      <app-route route="{{route}}" pattern="/:key" data="{{data}}"></app-route>
      <template is="dom-if" if="[[_isListActive(route.path)]]" restamp>
        <key-actions
          actions="{{actions}}"
          items="[[selectedItems]]"
          user="[[model.user.id]]"
          members="[[model.membersArray]]"
          org="[[model.org]]"
        >
          <mist-list
            selectable
            resizable
            column-menu
            multi-sort
            apiurl="/api/v2/keys"
            id="keysList"
            name="Keys"
            data-provider="[[dataProvider]]"
            store="[[store]]"
            primary-field-name="id"
            frozen="[[_getFrozenColumn()]]"
            visible="[[_getVisibleColumns()]]"
            selected-items="{{selectedItems}}"
            renderers="[[_getRenderers()]]"
            route="{{route}}"
            user-filter="[[model.sections.keys.q]]"
            actions="[[actions]]"
            filter-method="[[_ownerFilter()]]"
          >
            <p slot="no-items-found">No keys found.</p>
          </mist-list>
        </key-actions>

        <div
          class="absolute-bottom-right"
          hidden$="[[!checkPerm('key', 'add', null, model.org, model.user)]]"
        >
          <paper-fab id="keyAdd" icon="add" on-tap="_addResource"></paper-fab>
        </div>
      </template>
      <key-add
        store="[[store]]"
        section="[[model.sections.keys]]"
        hidden$="[[!_isAddPageActive(route.path)]]"
        docs="[[config.features.docs]]"
      ></key-add>
      <key-page
        id="keyPage"
        model="[[model]]"
        key="[[_getKeyPair(data.key)]]"
        resource-id="[[data.key]]"
        section="[[model.sections.keys]]"
        hidden$="[[!_isDetailsPageActive(route.path)]]"
      ></key-page>
    `;
  }

  static get is() {
    return 'page-keys';
  }

  static get properties() {
    return {
      model: {
        type: Object,
      },
      config: {
        type: Object,
      },
      actions: {
        type: Array,
      },
      selectedItems: {
        type: Array,
      },
      dataProvider: {
        type: Object,
        value() {
          return reduxDataProvider.bind(this);
        },
      },
      store: {
        type: Object,
        value() {
          return store;
        },
      },
    };
  }

  _isAddPageActive(_path) {
    return this.route.path === '/+add';
  }

  _isDetailsPageActive(path) {
    if (path && path !== '/+add' && this.querySelector('key-page')) {
      this.querySelector('key-page').updateState();
    }
    return path && path !== '/+add';
  }

  _isListActive(_path) {
    return !this.route.path;
  }

  _getKeyPair(id) {
    if (!id) return '';
    const key = this.store.getState().mainReducer.keys[id];
    if (!key) {
      this._setOneKey(id);
    }
    return key || '';
  }

  _addResource(_e) {
    this.dispatchEvent(
      new CustomEvent('go-to', {
        bubbles: true,
        composed: true,
        detail: {
          url: this.model.sections.keys.add,
        },
      })
    );
  }

  _getFrozenColumn() {
    return ['name'];
  }

  _getVisibleColumns() {
    return ['machines', 'default', 'created_by', 'id', 'tags'];
  }

  _getRenderers(_keys) {
    return {
      name: {
        body: (item, _row) => `<strong class="name">${item}</strong>`,
        cmp: (row1, row2) =>
          row1.name.localeCompare(row2.name, 'en', {
            sensitivity: 'base',
          }),
      },
      // sort by number of machines
      machines: {
        body: (_item, row) => row.associations.length,
        cmp: (row1, row2) => {
          const item1 = row1.associations.length;
          const item2 = row2.associations.length;

          if (item1 < item2) return -1;
          if (item2 < item1) return 1;
          return 0;
        },
      },
      default: {
        title: (_item, _row) => 'Default',
        body: (item, _row) =>
          item
            ? '<span class="default"><iron-icon icon="communication:vpn-key"></iron-icon> Default key</span>'
            : '',
      },
      owned_by: {
        title: (_item, _row) => 'owner',
        body: (item, _row) => item,
        cmp: (row1, row2) => {
          const item1 = row1.owner;
          const item2 = row2.owner;
          return item1.localeCompare(item2, 'en', { sensitivity: 'base' });
        },
      },
      created_by: {
        title: (_item, _row) => 'created by',
        body: (item, _row) => item,
        cmp: (row1, row2) => {
          const item1 = row1.created_by;
          const item2 = row2.created_by;
          return item1.localeCompare(item2, 'en', { sensitivity: 'base' });
        },
      },
      tags: {
        body: (item, _row) => {
          const tags = item;
          let display = '';
          Object.keys(tags || {})
            .sort()
            .forEach(key => {
              display += `<span class='tag'>${key}`;
              if (tags[key] != null && tags[key] !== '')
                display += `=${tags[key]}`;
              display += '</span>';
            });
          return display;
        },
        // sort by number of tags, resources with more tags come first
        // if two resources have the same number of tags show them in alphabetic order
        cmp: (row1, row2) => {
          const keys1 = Object.keys(row1.tags).sort();
          const keys2 = Object.keys(row2.tags).sort();
          if (keys1.length > keys2.length) return -1;
          if (keys1.length < keys2.length) return 1;
          const item1 = keys1.length > 0 ? keys1[0] : '';
          const item2 = keys2.length > 0 ? keys2[0] : '';
          return item1.localeCompare(item2, 'en', { sensitivity: 'base' });
        },
      },
    };
  }

  async _setOneKey(id) {
    const response = await (await fetch(`/api/v2/keys/${id}`)).json();
    this.$.keyPage.key = response.data;
  }
}

customElements.define('page-keys', PageKeys);
