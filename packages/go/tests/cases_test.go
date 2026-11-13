// The contract cases of http-media-type run against the Go package (MT-1 to MT-8). HTTP_MEDIA_TYPE_CASES is the path
// of contracts/media-type.json; make test-go sets it. A latin1 text of the cases is a Go string of its runes U+0000 to
// U+00FF (MT-1.1, binding B-8); a name, a type and a subtype are a text, a Go string of UTF-8 bytes.
package tests

import (
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"testing"

	liberrors "github.com/polyspec/http-media-type/packages/go/errors"
	mediatype "github.com/polyspec/http-media-type/packages/go/media_type"
)

type raises struct {
	Kind     string  `json:"kind"`
	Status   *int    `json:"status"`
	Category string  `json:"category"`
	Message  *string `json:"message"`
}

type parameter struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type mediaType struct {
	Type       string      `json:"type"`
	Subtype    string      `json:"subtype"`
	Parameters []parameter `json:"parameters"`
}

type cases struct {
	Parse []struct {
		ID        string     `json:"id"`
		Value     string     `json:"value"`
		MediaType *mediaType `json:"media_type"`
		Raises    *raises    `json:"raises"`
	} `json:"parse"`
	Format []struct {
		ID        string    `json:"id"`
		MediaType mediaType `json:"media_type"`
		Text      *string   `json:"text"`
		Raises    *raises   `json:"raises"`
	} `json:"format"`
	SameValue []struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		Left  string `json:"left"`
		Right string `json:"right"`
		Same  bool   `json:"same"`
	} `json:"sameValue"`
}

func load(t *testing.T) cases {
	t.Helper()
	text, err := os.ReadFile(os.Getenv("HTTP_MEDIA_TYPE_CASES"))
	if err != nil {
		t.Fatal(err)
	}
	var all cases
	if err := json.Unmarshal(text, &all); err != nil {
		t.Fatal(err)
	}
	return all
}

// The error type of each category (E-7), with its kind and status.
type failure interface {
	error
	Kind() string
	Status() (int, bool)
}

func category(err error) string {
	var value *liberrors.HTTPMediaTypeValueError
	var typ *liberrors.HTTPMediaTypeTypeError
	var io *liberrors.HTTPMediaTypeIoError
	var store *liberrors.HTTPMediaTypeStoreError
	var busy *liberrors.HTTPMediaTypeBusyError
	var internal *liberrors.HTTPMediaTypeInternalError
	switch {
	case errors.As(err, &value):
		return "value"
	case errors.As(err, &typ):
		return "type"
	case errors.As(err, &io):
		return "io"
	case errors.As(err, &store):
		return "store"
	case errors.As(err, &busy):
		return "busy"
	case errors.As(err, &internal):
		return "internal"
	}
	return ""
}

// check compares an error with the raises of a case: its category, kind, status and, when the case names one, its
// message.
func check(t *testing.T, id string, err error, want *raises) {
	t.Helper()
	var f failure
	if !errors.As(err, &f) || category(err) != want.Category || f.Kind() != want.Kind {
		t.Errorf("%s: got %v, want %s of kind %s", id, err, want.Category, want.Kind)
		return
	}
	status, ok := f.Status()
	if (want.Status == nil) == ok || (ok && status != *want.Status) {
		t.Errorf("%s: status %d %v", id, status, ok)
	}
	if want.Message != nil && f.Error() != *want.Message {
		t.Errorf("%s: message %q", id, f.Error())
	}
}

func plain(m mediatype.MediaType) mediaType {
	parameters := make([]parameter, len(m.Parameters))
	for i, p := range m.Parameters {
		parameters[i] = parameter{Name: p.Name, Value: p.Value}
	}
	return mediaType{Type: m.Type, Subtype: m.Subtype, Parameters: parameters}
}

func TestParse(t *testing.T) {
	group := load(t).Parse
	if len(group) == 0 {
		t.Fatal("no cases")
	}
	for _, c := range group {
		got, err := mediatype.Parse(c.Value)
		if c.Raises != nil {
			check(t, c.ID, err, c.Raises)
			continue
		}
		if err != nil || c.MediaType == nil {
			t.Errorf("%s: got %v", c.ID, err)
			continue
		}
		if !reflect.DeepEqual(plain(got), *c.MediaType) {
			t.Errorf("%s: got %q, want %q", c.ID, plain(got), *c.MediaType)
		}
	}
}

func TestFormat(t *testing.T) {
	group := load(t).Format
	if len(group) == 0 {
		t.Fatal("no cases")
	}
	for _, c := range group {
		parameters := make([]mediatype.Parameter, len(c.MediaType.Parameters))
		for i, p := range c.MediaType.Parameters {
			parameters[i] = mediatype.Parameter{Name: p.Name, Value: p.Value}
		}
		text, err := mediatype.Format(mediatype.MediaType{Type: c.MediaType.Type, Subtype: c.MediaType.Subtype, Parameters: parameters})
		if c.Raises != nil {
			check(t, c.ID, err, c.Raises)
			continue
		}
		if err != nil || c.Text == nil || text != *c.Text {
			t.Errorf("%s: got %q, %v", c.ID, text, err)
		}
	}
}

func TestSameValue(t *testing.T) {
	group := load(t).SameValue
	if len(group) == 0 {
		t.Fatal("no cases")
	}
	for _, c := range group {
		same, err := mediatype.SameValue(c.Name, c.Left, c.Right)
		if err != nil || same != c.Same {
			t.Errorf("%s: got %v, %v", c.ID, same, err)
		}
	}
}
